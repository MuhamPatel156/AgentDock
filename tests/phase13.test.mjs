import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {
 detectConflicts,
 addProjectMember,
 listProjectMembers,
 removeProjectMember,
 createReview,
 listReviews,
 decideReview
} from '../lib/collaboration.mjs';

test('detectConflicts cleanly auto-merges non-overlapping edits and flags true conflicts', () => {
 const base = {
  'index.html': '<h1>Base</h1>',
  'style.css': 'body { color: black; }',
  'app.js': 'console.log("base");'
 };

 // User A edits style.css
 const current = {
  'index.html': '<h1>Base</h1>',
  'style.css': 'body { color: blue; }',
  'app.js': 'console.log("base");'
 };

 // User B edits index.html and app.js cleanly
 const incoming = {
  'index.html': '<h1>Updated</h1>',
  'style.css': 'body { color: black; }',
  'app.js': 'console.log("base");'
 };

 const resClean = detectConflicts(base, current, incoming);
 assert.equal(resClean.hasConflicts, false);
 assert.equal(resClean.merged['index.html'], '<h1>Updated</h1>');
 assert.equal(resClean.merged['style.css'], 'body { color: blue; }');

 // Now both edit style.css differently -> conflict!
 const incomingConflict = {
  ...incoming,
  'style.css': 'body { color: red; }'
 };

 const resConflict = detectConflicts(base, current, incomingConflict);
 assert.equal(resConflict.hasConflicts, true);
 assert.equal(resConflict.conflicts.length, 1);
 assert.equal(resConflict.conflicts[0].path, 'style.css');
 assert.equal(resConflict.conflicts[0].current, 'body { color: blue; }');
 assert.equal(resConflict.conflicts[0].incoming, 'body { color: red; }');
});

test('Project members management enforces valid roles and lists members with usernames', async t => {
 const {app} = await fixture(t);
 const owner = await app.store.register('owner-team', 'password123456');
 const editor = await app.store.register('editor-team', 'password123456');
 const proj = 'proj-team-1';

 // Add editor
 const m1 = addProjectMember(app.store, owner.id, proj, editor.id, 'editor');
 assert.equal(m1.role, 'editor');

 // List members
 const members = listProjectMembers(app.store, proj);
 assert.equal(members.length, 1);
 assert.equal(members[0].username, 'editor-team');
 assert.equal(members[0].role, 'editor');

 // Invalid role throws
 assert.throws(() => addProjectMember(app.store, owner.id, proj, editor.id, 'superuser'), /Invalid role/);

 // Remove member
 const removed = removeProjectMember(app.store, proj, editor.id);
 assert.equal(removed, true);
 assert.equal(listProjectMembers(app.store, proj).length, 0);
});

test('Project Reviews support proposal submission and reviewer decision workflow', async t => {
 const {app} = await fixture(t);
 const author = await app.store.register('rev-author', 'password123456');
 const reviewer = await app.store.register('rev-reviewer', 'password123456');
 const proj = 'proj-reviews-1';

 const changes = {'components/button.html': '<button>Click</button>'};
 const rev = createReview(app.store, author.id, proj, {
  title: 'Add primary action button',
  description: 'Implements standard CTA button component',
  changes
 });

 assert.equal(rev.title, 'Add primary action button');
 assert.equal(rev.status, 'open');

 // List reviews
 const reviews = listReviews(app.store, proj);
 assert.equal(reviews.length, 1);
 assert.equal(reviews[0].id, rev.id);
 assert.equal(reviews[0].changes['components/button.html'], '<button>Click</button>');

 // Decide review
 const decided = decideReview(app.store, reviewer.id, proj, rev.id, 'approved', 'Looks good to merge.');
 assert.equal(decided.status, 'approved');
 assert.equal(decided.comment, 'Looks good to merge.');
});

test('HTTP API routes for team members, conflict detection, and reviews work end-to-end', async t => {
 const {call, register} = await fixture(t);
 const owner = await register('http-team-owner');
 const member = await register('http-team-member');
 const proj = 'proj-http-collab';

 // 1. Add project member
 const addRes = await call(`/api/projects/${proj}/members`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {userId: member.user.id, role: 'reviewer'}
 });
 assert.equal(addRes.status, 200);
 assert.equal(addRes.data.role, 'reviewer');

 // 2. List members
 const listRes = await call(`/api/projects/${proj}/members`, {cookie: owner.cookie});
 assert.equal(listRes.status, 200);
 assert.equal(listRes.data.members.length, 1);
 assert.equal(listRes.data.members[0].username, 'http-team-member');

 // 3. 3-way merge API
 const mergeRes = await call(`/api/projects/${proj}/collaborate/merge`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {
   baseFiles: {'main.js': 'a = 1;'},
   currentFiles: {'main.js': 'a = 2;'},
   incomingFiles: {'main.js': 'a = 3;'}
  }
 });
 assert.equal(mergeRes.status, 200);
 assert.equal(mergeRes.data.hasConflicts, true);
 assert.equal(mergeRes.data.conflicts.length, 1);

 // 4. Create review
 const revRes = await call(`/api/projects/${proj}/reviews`, {
  method: 'POST',
  cookie: member.cookie,
  body: {
   title: 'Update logic',
   changes: {'main.js': 'a = 42;'}
  }
 });
 assert.equal(revRes.status, 200);
 assert.equal(revRes.data.status, 'open');
 const revId = revRes.data.id;

 // 5. List reviews
 const revList = await call(`/api/projects/${proj}/reviews`, {cookie: owner.cookie});
 assert.equal(revList.status, 200);
 assert.equal(revList.data.reviews.length, 1);

 // 6. Decide review
 const decideRes = await call(`/api/projects/${proj}/reviews/${revId}/decide`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {decision: 'merged', comment: 'Approved and merged'}
 });
 assert.equal(decideRes.status, 200);
 assert.equal(decideRes.data.status, 'merged');

 // 7. Remove member
 const delMem = await call(`/api/projects/${proj}/members/${member.user.id}`, {
  method: 'DELETE',
  cookie: owner.cookie
 });
 assert.equal(delMem.status, 200);
 assert.equal(delMem.data.ok, true);
});
