import {randomUUID} from 'node:crypto';

export function detectConflicts(baseFiles = {}, currentFiles = {}, incomingFiles = {}) {
 const allPaths = new Set([
  ...Object.keys(baseFiles),
  ...Object.keys(currentFiles),
  ...Object.keys(incomingFiles)
 ]);

 const conflicts = [];
 const merged = {};

 for (const p of allPaths) {
  const base = baseFiles[p] !== undefined ? baseFiles[p] : null;
  const current = currentFiles[p] !== undefined ? currentFiles[p] : null;
  const incoming = incomingFiles[p] !== undefined ? incomingFiles[p] : null;

  // Case 1: Unchanged in incoming -> keep current
  if (base === incoming) {
   if (current !== null) merged[p] = current;
   continue;
  }

  // Case 2: Unchanged in current -> take incoming
  if (base === current) {
   if (incoming !== null) merged[p] = incoming;
   continue;
  }

  // Case 3: Both modified identically
  if (current === incoming) {
   if (current !== null) merged[p] = current;
   continue;
  }

  // Case 4: Overlapping conflicting edits
  conflicts.push({
   path: p,
   base,
   current,
   incoming
  });
 }

 return {
  hasConflicts: conflicts.length > 0,
  conflicts,
  merged: conflicts.length === 0 ? merged : null
 };
}

export function addProjectMember(store, ownerId, projectId, targetUserId, role = 'editor') {
 const allowedRoles = ['editor', 'reviewer', 'viewer'];
 if (!allowedRoles.includes(role)) throw Error(`Invalid role. Choose from: ${allowedRoles.join(', ')}`);
 const id = randomUUID(), now = Date.now();
 store.db.prepare(
  'INSERT INTO project_members (id, project_id, user_id, role, invited_by, created) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, user_id) DO UPDATE SET role=excluded.role'
 ).run(id, projectId, targetUserId, role, ownerId, now);
 return {projectId, userId: targetUserId, role, updated: now};
}

export function listProjectMembers(store, projectId) {
 return store.db.prepare(
  'SELECT m.id, m.project_id, m.user_id, m.role, m.created, u.username FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.created ASC'
 ).all(projectId);
}

export function removeProjectMember(store, projectId, targetUserId) {
 return store.db.prepare(
  'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
 ).run(projectId, targetUserId).changes > 0;
}

export function createReview(store, authorId, projectId, {title, description = '', changes}) {
 if (!title || typeof title !== 'string') throw Error('Review title required.');
 if (!changes || typeof changes !== 'object') throw Error('Review changes object required.');
 const id = randomUUID(), now = Date.now();
 store.db.prepare(
  'INSERT INTO project_reviews (id, project_id, author_id, title, description, changes, status, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
 ).run(id, projectId, authorId, title.slice(0, 120), String(description || '').slice(0, 1000), JSON.stringify(changes), 'open', now, now);
 return {id, projectId, title, status: 'open', created: now};
}

export function listReviews(store, projectId) {
 return store.db.prepare(
  'SELECT r.*, u.username as author_username FROM project_reviews r JOIN users u ON u.id = r.author_id WHERE r.project_id = ? ORDER BY r.created DESC'
 ).all(projectId).map(r => ({
  ...r,
  changes: JSON.parse(r.changes || '{}')
 }));
}

export function decideReview(store, reviewerId, projectId, reviewId, decision, comment = '') {
 const allowed = ['approved', 'rejected', 'merged'];
 if (!allowed.includes(decision)) throw Error(`Invalid decision: ${decision}`);
 const review = store.db.prepare('SELECT * FROM project_reviews WHERE id=? AND project_id=?').get(reviewId, projectId);
 if (!review) throw Error('Review unavailable.');

 const now = Date.now();
 store.db.prepare(
  'UPDATE project_reviews SET status=?, reviewer_id=?, comment=?, updated=? WHERE id=?'
 ).run(decision, reviewerId, String(comment || '').slice(0, 500), now, reviewId);

 return {
  id: reviewId,
  projectId,
  status: decision,
  reviewerId,
  comment,
  updated: now
 };
}
