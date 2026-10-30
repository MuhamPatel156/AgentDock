import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptSecret, decryptSecret, maskSecret} from '../lib/secrets.mjs';
import {fixture} from './helpers.mjs';

test('AES-256-GCM encryption round-trips cleanly and verifies auth tags', () => {
 const plain = 'my-super-secret-api-key-12345';
 const pwd = 'master-password-123';

 const enc = encryptSecret(plain, pwd);
 assert.ok(enc.ciphertext);
 assert.ok(enc.iv);
 assert.ok(enc.tag);

 const dec = decryptSecret(enc.ciphertext, pwd, enc.iv, enc.tag);
 assert.equal(dec, plain);

 // Tampered ciphertext throws
 assert.throws(() => decryptSecret(enc.ciphertext.slice(0, -2) + 'aa', pwd, enc.iv, enc.tag));

 // Wrong password throws
 assert.throws(() => decryptSecret(enc.ciphertext, 'wrong-password', enc.iv, enc.tag));
});

test('maskSecret produces safe masked display strings', () => {
 assert.equal(maskSecret('secret-token-abcdef'), '••••••••cdef');
 assert.equal(maskSecret('abcd'), '••••abcd');
 assert.equal(maskSecret(''), '••••••••');
});

test('Store per-project secrets enforce project and user isolation', async t => {
 const {app, register} = await fixture(t);
 const userA = await register('secret-user-a');
 const userB = await register('secret-user-b');

 const proj1 = 'proj-1', proj2 = 'proj-2';
 const master = 'test-master-key';

 // User A saves secret in proj1
 const res = app.store.setProjectSecret(userA.user.id, proj1, 'API_KEY', 'val-12345', master);
 assert.equal(res.key, 'API_KEY');
 assert.equal(res.masked, '••••••••2345');

 // User A can read it back
 const val = app.store.getProjectSecret(userA.user.id, proj1, 'API_KEY', master);
 assert.equal(val, 'val-12345');

 // Proj2 cannot see proj1 secret
 assert.equal(app.store.getProjectSecret(userA.user.id, proj2, 'API_KEY', master), null);

 // User B cannot see user A secret
 assert.equal(app.store.getProjectSecret(userB.user.id, proj1, 'API_KEY', master), null);

 // Rotate secret
 app.store.rotateProjectSecret(userA.user.id, proj1, 'API_KEY', 'new-val-9999', master);
 assert.equal(app.store.getProjectSecret(userA.user.id, proj1, 'API_KEY', master), 'new-val-9999');

 // Delete secret
 assert.equal(app.store.deleteProjectSecret(userA.user.id, proj1, 'API_KEY'), true);
 assert.equal(app.store.getProjectSecret(userA.user.id, proj1, 'API_KEY', master), null);
});

test('HTTP endpoints support project secret creation, listing and deletion', async t => {
 const {call, register} = await fixture(t);
 const user = await register('http-secret-user');
 const proj = 'proj-100';

 // Create secret
 const postRes = await call(`/api/projects/${proj}/secrets`, {
  method: 'POST',
  cookie: user.cookie,
  body: {key: 'DATABASE_URL', value: 'postgres://user:pass@localhost:5432/db'}
 });
 assert.equal(postRes.status, 200);
 assert.equal(postRes.data.key, 'DATABASE_URL');
 assert.ok(postRes.data.masked.includes('••••'));

 // List secrets
 const listRes = await call(`/api/projects/${proj}/secrets`, {
  cookie: user.cookie
 });
 assert.equal(listRes.status, 200);
 assert.equal(listRes.data.secrets.length, 1);
 assert.equal(listRes.data.secrets[0].key, 'DATABASE_URL');

 // Delete secret
 const delRes = await call(`/api/projects/${proj}/secrets/DATABASE_URL`, {
  method: 'DELETE',
  cookie: user.cookie
 });
 assert.equal(delRes.status, 200);
 assert.equal(delRes.data.ok, true);

 // List is now empty
 const listEmpty = await call(`/api/projects/${proj}/secrets`, {
  cookie: user.cookie
 });
 assert.equal(listEmpty.data.secrets.length, 0);
});
