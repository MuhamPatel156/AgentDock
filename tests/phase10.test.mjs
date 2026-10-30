import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {WorkerQueue} from '../lib/workers.mjs';
import {verifyPinnedImage, PINNED_IMAGES} from '../lib/pinned-images.mjs';
import {sweepOrphans} from '../lib/orphan-cleanup.mjs';
import {getMonitoringMetrics} from '../lib/monitoring.mjs';
import {mkdir, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';

test('WorkerQueue enqueues, processes by priority, records results, and cancels jobs', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('worker-user', 'password123456');

 const queue = new WorkerQueue(app.store, {maxConcurrency: 2});
 queue.registerHandler('add', async job => {
  return {sum: job.payload.a + job.payload.b};
 });

 // Enqueue two jobs with different priorities
 const jLow = queue.enqueue({userId: user.id, type: 'add', payload: {a: 1, b: 2}, priority: 1});
 const jHigh = queue.enqueue({userId: user.id, type: 'add', payload: {a: 10, b: 20}, priority: 10});

 // First processed is higher priority
 const processedHigh = await queue.processNext();
 assert.equal(processedHigh, true);

 const highResult = queue.getJob(jHigh.id, user.id);
 assert.equal(highResult.status, 'completed');
 assert.equal(highResult.result.sum, 30);

 // Next processed is lower priority
 const processedLow = await queue.processNext();
 assert.equal(processedLow, true);

 const lowResult = queue.getJob(jLow.id, user.id);
 assert.equal(lowResult.status, 'completed');
 assert.equal(lowResult.result.sum, 3);

 // Enqueue a job and cancel it
 const jCancel = queue.enqueue({userId: user.id, type: 'add', payload: {a: 5, b: 5}});
 const cancelled = queue.cancelJob(jCancel.id, user.id);
 assert.equal(cancelled, true);

 const cancelResult = queue.getJob(jCancel.id, user.id);
 assert.equal(cancelResult.status, 'cancelled');

 // Metrics reflect jobs
 const metrics = queue.getMetrics();
 assert.equal(metrics.completed, 2);
 assert.equal(metrics.cancelled, 1);
});

test('WorkerQueue retries on failure up to maxAttempts', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('worker-retry-user', 'password123456');

 const queue = new WorkerQueue(app.store, {maxConcurrency: 1});
 queue.registerHandler('fail_task', async () => {
  throw Error('Task execution crashed.');
 });

 const job = queue.enqueue({userId: user.id, type: 'fail_task', maxAttempts: 2});

 // First failure -> status remains pending
 await queue.processNext();
 let current = queue.getJob(job.id, user.id);
 assert.equal(current.status, 'pending');
 assert.equal(current.attempts, 1);

 // Second failure -> status becomes failed
 await queue.processNext();
 current = queue.getJob(job.id, user.id);
 assert.equal(current.status, 'failed');
 assert.equal(current.attempts, 2);
 assert.ok(current.error.includes('crashed'));
});

test('Pinned container image registry validates digests and blocks unpinned images', () => {
 assert.ok(PINNED_IMAGES['agentdock-python-web']);

 // Approved pinned image
 const checkOk = verifyPinnedImage('agentdock-python-web:0.2.0');
 assert.equal(checkOk.allowed, true);
 assert.equal(checkOk.pinned, true);

 // Unapproved image
 const checkBad = verifyPinnedImage('unknown-registry/my-image:latest');
 assert.equal(checkBad.allowed, false);
 assert.equal(checkBad.pinned, false);

 // Digest mismatch
 const checkMismatch = verifyPinnedImage('agentdock-python-web:0.2.0', 'sha256:00000000000000000000');
 assert.equal(checkMismatch.allowed, false);
 assert.ok(checkMismatch.reason.includes('digest mismatch'));
});

test('Orphan cleanup removes expired staging directories', async t => {
 const {dir} = await fixture(t);
 const stagingOld = path.join(dir, 'runtime', 'old-session');
 await mkdir(stagingOld, {recursive: true});
 await writeFile(path.join(stagingOld, 'data.txt'), 'old data');

 // Set maxAgeMs to 0 to simulate expired directory
 const summary = await sweepOrphans(dir, {maxAgeMs: 0});
 assert.ok(summary.sweptFolders >= 1);
});

test('Monitoring metrics report process health, memory, and database state', async t => {
 const {app} = await fixture(t);
 const queue = new WorkerQueue(app.store);
 const metrics = getMonitoringMetrics({store: app.store, workerQueue: queue});

 assert.equal(metrics.status, 'healthy');
 assert.ok(metrics.uptime >= 0);
 assert.ok(metrics.memory.heapUsedMb > 0);
 assert.ok(metrics.queue);
 assert.equal(typeof metrics.database.users, 'number');
});

test('HTTP API endpoints for monitoring, pinned images, and workers work end-to-end', async t => {
 const {call, register} = await fixture(t);
 const owner = await register('owner-monitoring');
 const member = await register('member-monitoring');

 // Monitoring routes: 403 for member, 200 for owner
 const memCheck = await call('/api/monitoring/metrics', {cookie: member.cookie});
 assert.equal(memCheck.status, 403);

 const ownerCheck = await call('/api/monitoring/metrics', {cookie: owner.cookie});
 assert.equal(ownerCheck.status, 200);
 assert.equal(ownerCheck.data.status, 'healthy');

 // Pinned images API
 const pinnedList = await call('/api/images/pinned', {cookie: member.cookie});
 assert.equal(pinnedList.status, 200);
 assert.ok(pinnedList.data.images['agentdock-python-web']);

 const verifyImg = await call('/api/images/verify', {
  method: 'POST',
  cookie: member.cookie,
  body: {image: 'agentdock-python-web:0.2.0'}
 });
 assert.equal(verifyImg.status, 200);
 assert.equal(verifyImg.data.allowed, true);

 // Worker jobs API
 const postJob = await call('/api/workers/jobs', {
  method: 'POST',
  cookie: member.cookie,
  body: {type: 'build', payload: {target: 'app'}, priority: 5}
 });
 assert.equal(postJob.status, 200);
 assert.ok(postJob.data.id);
 assert.equal(postJob.data.type, 'build');

 const listJobs = await call('/api/workers/jobs', {cookie: member.cookie});
 assert.equal(listJobs.status, 200);
 assert.ok(listJobs.data.jobs.length >= 1);

 const getJob = await call(`/api/workers/jobs/${postJob.data.id}`, {cookie: member.cookie});
 assert.equal(getJob.status, 200);
 assert.equal(getJob.data.job.id, postJob.data.id);

 const cancelJob = await call(`/api/workers/jobs/${postJob.data.id}/cancel`, {
  method: 'POST',
  cookie: member.cookie
 });
 assert.equal(cancelJob.status, 200);
 assert.equal(cancelJob.data.ok, true);
});
