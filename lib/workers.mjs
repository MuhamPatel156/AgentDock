import {randomUUID} from 'node:crypto';

export class WorkerQueue {
 constructor(store, {maxConcurrency = 2} = {}) {
  this.store = store;
  this.maxConcurrency = maxConcurrency;
  this.activeCount = 0;
  this.timer = null;
  this.handlers = new Map();
 }

 registerHandler(type, fn) {
  this.handlers.set(type, fn);
 }

 enqueue({userId, type, payload = {}, priority = 0, maxAttempts = 3}) {
  if (!userId || !type) throw Error('User ID and job type are required.');
  const id = randomUUID(), now = Date.now();
  this.store.db.prepare(
   'INSERT INTO worker_jobs (id, user_id, type, payload, status, priority, attempts, max_attempts, created) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
  ).run(id, userId, type, JSON.stringify(payload), 'pending', priority, maxAttempts, now);

  return {
   id,
   userId,
   type,
   payload,
   status: 'pending',
   priority,
   attempts: 0,
   maxAttempts,
   created: now
  };
 }

 getJob(id, userId) {
  const row = this.store.db.prepare('SELECT * FROM worker_jobs WHERE id=? AND (user_id=? OR ? IS NULL)').get(id, userId, userId);
  if (!row) return null;
  return {
   ...row,
   payload: JSON.parse(row.payload || '{}'),
   result: row.result ? JSON.parse(row.result) : null
  };
 }

 listJobs(userId, {status = null, limit = 50} = {}) {
  let query = 'SELECT * FROM worker_jobs WHERE user_id=?';
  const params = [userId];
  if (status) {
   query += ' AND status=?';
   params.push(status);
  }
  query += ' ORDER BY created DESC LIMIT ?';
  params.push(limit);

  return this.store.db.prepare(query).all(...params).map(row => ({
   ...row,
   payload: JSON.parse(row.payload || '{}'),
   result: row.result ? JSON.parse(row.result) : null
  }));
 }

 cancelJob(id, userId) {
  const r = this.store.db.prepare(
   "UPDATE worker_jobs SET status='cancelled', finished=? WHERE id=? AND user_id=? AND status IN ('pending', 'running')"
  ).run(Date.now(), id, userId);
  return r.changes > 0;
 }

 async processNext() {
  if (this.activeCount >= this.maxConcurrency) return false;

  this.store.db.exec('BEGIN IMMEDIATE');
  let job;
  try {
   const candidate = this.store.db.prepare(
    "SELECT * FROM worker_jobs WHERE status='pending' ORDER BY priority DESC, created ASC LIMIT 1"
   ).get();

   if (!candidate) {
    this.store.db.exec('COMMIT');
    return false;
   }

   const now = Date.now();
   const newAttempts = candidate.attempts + 1;
   this.store.db.prepare(
    "UPDATE worker_jobs SET status='running', started=?, attempts=? WHERE id=?"
   ).run(now, newAttempts, candidate.id);
   this.store.db.exec('COMMIT');

   job = {
    ...candidate,
    attempts: newAttempts,
    payload: JSON.parse(candidate.payload || '{}')
   };
  } catch (err) {
   this.store.db.exec('ROLLBACK');
   throw err;
  }

  this.activeCount++;
  const handler = this.handlers.get(job.type);

  try {
   let result = null;
   if (handler) {
    result = await handler(job);
   } else {
    throw Error(`No handler registered for worker job type: ${job.type}`);
   }

   this.store.db.prepare(
    "UPDATE worker_jobs SET status='completed', result=?, finished=? WHERE id=?"
   ).run(JSON.stringify(result || {}), Date.now(), job.id);
  } catch (err) {
   const now = Date.now();
   const finalStatus = job.attempts >= job.max_attempts ? 'failed' : 'pending';
   this.store.db.prepare(
    "UPDATE worker_jobs SET status=?, error=?, finished=? WHERE id=?"
   ).run(finalStatus, err.message, now, job.id);
  } finally {
   this.activeCount--;
  }

  return true;
 }

 getMetrics() {
  const counts = this.store.db.prepare(
   'SELECT status, COUNT(*) as count FROM worker_jobs GROUP BY status'
  ).all();

  const metrics = {pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: 0};
  for (const c of counts) {
   metrics[c.status] = c.count;
   metrics.total += c.count;
  }
  metrics.activeWorkers = this.activeCount;
  metrics.maxConcurrency = this.maxConcurrency;
  return metrics;
 }

 start(intervalMs = 300) {
  if (this.timer) return;
  this.timer = setInterval(async () => {
   try {
    while (this.activeCount < this.maxConcurrency) {
     const processed = await this.processNext();
     if (!processed) break;
    }
   } catch {}
  }, intervalMs);
 }

 stop() {
  if (this.timer) {
   clearInterval(this.timer);
   this.timer = null;
  }
 }
}
