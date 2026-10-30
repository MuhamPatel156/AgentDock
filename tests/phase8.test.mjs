import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {getMigrationStatus, runMigrations} from '../lib/migrations.mjs';
import {createInstanceBackup, restoreInstanceBackup} from '../lib/backup.mjs';
import {zipFiles, unzipFiles} from '../lib/zip.mjs';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Schema migrations are recorded, idempotent, and report status accurately', async t => {
 const {app} = await fixture(t);
 const status = app.store.migrationStatus();
 assert.ok(status.currentVersion >= 3);
 assert.equal(status.pending.length, 0);
 assert.ok(status.applied.length >= 3);

 // Re-running migrations is idempotent and applies 0 new migrations
 const rerun = app.store.runPendingMigrations();
 assert.equal(rerun.appliedCount, 0);
 assert.equal(rerun.status.currentVersion, status.currentVersion);
});

test('Project Databases support creation, schema inspection, and query execution with user/project isolation', async t => {
 const {app, dir} = await fixture(t);
 const userA = await app.store.register('db-user-a', 'password1234567');
 const userB = await app.store.register('db-user-b', 'password1234567');
 const proj1 = 'proj-alpha', proj2 = 'proj-beta';

 // User A creates database in proj1
 const dbMeta = app.store.createProjectDatabase(userA.id, proj1, 'analytics');
 assert.equal(dbMeta.name, 'analytics');
 assert.equal(dbMeta.filename, 'analytics.sqlite');

 // List databases
 const dbsA = app.store.listProjectDatabases(userA.id, proj1);
 assert.equal(dbsA.length, 1);
 assert.equal(dbsA[0].name, 'analytics');

 // User B cannot see User A's database
 const dbsB = app.store.listProjectDatabases(userB.id, proj1);
 assert.equal(dbsB.length, 0);

 // Proj2 cannot see proj1's database
 const dbsA2 = app.store.listProjectDatabases(userA.id, proj2);
 assert.equal(dbsA2.length, 0);

 // Execute DDL
 const ddlRes = app.store.executeProjectDatabase(userA.id, proj1, 'analytics', `
  CREATE TABLE metrics (id INTEGER PRIMARY KEY, key TEXT, val REAL);
  INSERT INTO metrics (key, val) VALUES ('cpu', 42.5), ('mem', 78.2);
 `, [], dir);
 assert.equal(ddlRes.changes, 1);

 // Inspect schema
 const schema = app.store.inspectProjectDatabase(userA.id, proj1, 'analytics', dir);
 assert.equal(schema.tables.length, 1);
 assert.equal(schema.tables[0].name, 'metrics');

 // Query rows
 const queryRes = app.store.executeProjectDatabase(userA.id, proj1, 'analytics', 'SELECT * FROM metrics ORDER BY id ASC', [], dir);
 assert.equal(queryRes.rows.length, 2);
 assert.equal(queryRes.rows[0].key, 'cpu');
 assert.equal(queryRes.rows[0].val, 42.5);

 // Delete database
 const delRes = app.store.deleteProjectDatabase(userA.id, proj1, 'analytics', dir);
 assert.equal(delRes, true);
 assert.equal(app.store.listProjectDatabases(userA.id, proj1).length, 0);
});

test('Persistent Project Files enforce path safety, size limits, and persistence', async t => {
 const {app, dir} = await fixture(t);
 const user = await app.store.register('files-user', 'password1234567');
 const proj = 'proj-files-test';

 // Path traversal is rejected
 assert.throws(() => app.store.saveProjectFile(user.id, proj, '../escape.csv', 'bad', dir));
 assert.throws(() => app.store.saveProjectFile(user.id, proj, 'sub/../../escape.csv', 'bad', dir));

 // Save valid data file
 const saved = app.store.saveProjectFile(user.id, proj, 'datasets/data.csv', 'id,val\n1,100\n2,200', dir);
 assert.equal(saved.path, 'datasets/data.csv');
 assert.ok(saved.size > 0);
 assert.ok(saved.sha256);

 // List files
 const list = app.store.listProjectFiles(user.id, proj);
 assert.equal(list.length, 1);
 assert.equal(list[0].path, 'datasets/data.csv');

 // Read file
 const content = app.store.getProjectFile(user.id, proj, 'datasets/data.csv', dir);
 assert.ok(content);
 assert.equal(content.toString('utf8'), 'id,val\n1,100\n2,200');

 // Delete file
 const deleted = app.store.deleteProjectFile(user.id, proj, 'datasets/data.csv', dir);
 assert.equal(deleted, true);
 assert.equal(app.store.listProjectFiles(user.id, proj).length, 0);
});

test('Instance Backup creates a verified archive, and Restore recovers project files safely', async t => {
 const {app, dir} = await fixture(t);
 const owner = await app.store.register('owner-admin', 'password1234567');

 // Save some project data and files
 app.store.saveProjectFile(owner.id, 'proj-b1', 'data.csv', 'a,b,c\n1,2,3', dir);

 // Create instance backup
 const backup = await createInstanceBackup({store: app.store, dataDir: dir, userId: owner.id});
 assert.ok(backup.id);
 assert.ok(backup.size > 0);
 assert.ok(backup.zipBuffer);
 assert.equal(backup.manifest.userId, owner.id);
 assert.ok(backup.manifest.entries['projects/proj-b1/files/data.csv']);

 // Verify backup record in store
 const backups = app.store.listBackups(owner.id);
 assert.equal(backups.length, 1);
 assert.equal(backups[0].id, backup.id);

 // Restore into clean test directory
 const testRoot = path.dirname(fileURLToPath(import.meta.url));
 const restoreDir = await mkdtemp(path.join(testRoot, 'tmp-restore-'));
 t.after(async () => {
  await rm(restoreDir, {recursive: true, force: true});
 });

 const restoreResult = await restoreInstanceBackup({
  zipBuffer: backup.zipBuffer,
  dataDir: restoreDir,
  store: app.store,
  userId: owner.id
 });
 assert.equal(restoreResult.restored, true);
 assert.ok(restoreResult.filesCount >= 1);

 // Verify restored file content
 const restoredFile = await readFile(path.join(restoreDir, 'projects', owner.id, 'proj-b1', 'files', 'data.csv'), 'utf8');
 assert.equal(restoredFile, 'a,b,c\n1,2,3');

 // Tampered archive throws on restore
 const tamperedFiles = unzipFiles(backup.zipBuffer);
 tamperedFiles['projects/proj-b1/files/data.csv'] = Buffer.from('corrupted data');
 const tamperedZip = zipFiles(tamperedFiles);
 await assert.rejects(
  () => restoreInstanceBackup({zipBuffer: tamperedZip, dataDir: restoreDir, store: app.store, userId: owner.id}),
  /checksum mismatch/
 );
});

test('HTTP API routes for migrations, databases, files, and backups are secured and functional', async t => {
 const {call, register} = await fixture(t);
 const owner = await register('site-owner');
 const member = await register('regular-member');
 const proj = 'proj-api-test';

 // Migrations: Member gets 403, Owner gets 200
 const memberMig = await call('/api/migrations', {cookie: member.cookie});
 assert.equal(memberMig.status, 403);
 const ownerMig = await call('/api/migrations', {cookie: owner.cookie});
 assert.equal(ownerMig.status, 200);
 assert.ok(ownerMig.data.currentVersion >= 3);

 // Project Databases API
 const createDb = await call(`/api/projects/${proj}/databases`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {name: 'app_db'}
 });
 assert.equal(createDb.status, 200);
 assert.equal(createDb.data.name, 'app_db');

 const listDbs = await call(`/api/projects/${proj}/databases`, {cookie: owner.cookie});
 assert.equal(listDbs.status, 200);
 assert.equal(listDbs.data.databases.length, 1);

 // Run query via API
 const queryRes = await call(`/api/projects/${proj}/databases/app_db/query`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {sql: "CREATE TABLE users (id INT, name TEXT); INSERT INTO users VALUES (1, 'Alice');"}
 });
 assert.equal(queryRes.status, 200);

 // Query data back
 const selectRes = await call(`/api/projects/${proj}/databases/app_db/query`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {sql: 'SELECT * FROM users'}
 });
 assert.equal(selectRes.status, 200);
 assert.equal(selectRes.data.rows.length, 1);
 assert.equal(selectRes.data.rows[0].name, 'Alice');

 // Persistent Files API
 const postFile = await call(`/api/projects/${proj}/files`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {path: 'config.json', content: '{"active": true}'}
 });
 assert.equal(postFile.status, 200);
 assert.equal(postFile.data.path, 'config.json');

 const listFiles = await call(`/api/projects/${proj}/files`, {cookie: owner.cookie});
 assert.equal(listFiles.status, 200);
 assert.equal(listFiles.data.files.length, 1);

 // Read file back
 const getFile = await call(`/api/projects/${proj}/files/config.json`, {cookie: owner.cookie});
 assert.equal(getFile.status, 200);
 assert.equal(getFile.buffer.toString('utf8'), '{"active": true}');

 // Backups API: Member gets 403, Owner gets 200
 const memberBackup = await call('/api/backups', {cookie: member.cookie});
 assert.equal(memberBackup.status, 403);

 const ownerCreateBackup = await call('/api/backups', {method: 'POST', cookie: owner.cookie});
 assert.equal(ownerCreateBackup.status, 200);
 assert.ok(ownerCreateBackup.data.id);
 assert.ok(ownerCreateBackup.data.sha256);
});
