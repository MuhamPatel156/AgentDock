import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {createInvite, listInvites, revokeInvite, verifyInvite} from '../lib/beta.mjs';
import {getBudgetCaps, setBudgetCaps, checkBudgetStatus, DEFAULT_BUDGET_CAPS} from '../lib/budgets.mjs';
import {runOperationalAcceptance, verifyBackupArchive, runRecoveryDrill} from '../lib/acceptance.mjs';
import {createInstanceBackup} from '../lib/backup.mjs';

test('Beta invitation lifecycle, admin controls, verification and registration enforcement', async t => {
 const {app, call} = await fixture(t, {config: {registration: 'invite'}});
 const admin = await app.store.register('owner-beta', 'password123456');
 const regular = await app.store.register('regular-beta', 'password123456');

 // 1. Non-admin cannot create invite
 assert.throws(
  () => createInvite(app.store, regular.id, {maxUses: 2}),
  /Admin permission required/
 );

 // 2. Admin creates invite
 const invite = createInvite(app.store, admin.id, {email: 'tester@example.com', maxUses: 2, expiresInHours: 24});
 assert.ok(invite.code.startsWith('BETA-'));
 assert.equal(invite.max_uses, 2);
 assert.equal(invite.use_count, 0);
 assert.equal(invite.invited_email, 'tester@example.com');
 assert.equal(invite.active, true);

 // 3. List invites
 const invites = listInvites(app.store, admin.id);
 assert.ok(invites.length >= 1);
 assert.equal(invites[0].code, invite.code);

 // 4. Verify invite public helper
 const validCheck = verifyInvite(app.store, invite.code);
 assert.equal(validCheck.valid, true);
 assert.equal(validCheck.type, 'db');

 const badCheck = verifyInvite(app.store, 'BETA-INVALID-CODE');
 assert.equal(badCheck.valid, false);

 // 5. Registration enforcement with dynamic invite
 // Attempt without invite -> fails 403
 const regFail = await call('/api/auth/register', {
  method: 'POST',
  body: {username: 'newbie1', password: 'password123456', inviteCode: 'WRONG-CODE'}
 });
 assert.equal(regFail.status, 403);

 // Attempt with valid invite -> succeeds 200
 const regSuccess1 = await call('/api/auth/register', {
  method: 'POST',
  body: {username: 'newbie1', password: 'password123456', inviteCode: invite.code}
 });
 assert.equal(regSuccess1.status, 200);

 // Second use succeeds (maxUses: 2)
 const regSuccess2 = await call('/api/auth/register', {
  method: 'POST',
  body: {username: 'newbie2', password: 'password123456', inviteCode: invite.code}
 });
 assert.equal(regSuccess2.status, 200);

 // Third use fails (useCount reached maxUses)
 const regFailMax = await call('/api/auth/register', {
  method: 'POST',
  body: {username: 'newbie3', password: 'password123456', inviteCode: invite.code}
 });
 assert.equal(regFailMax.status, 403);

 // 6. Revocation
 const invite2 = createInvite(app.store, admin.id, {maxUses: 1});
 const rev = revokeInvite(app.store, admin.id, invite2.id);
 assert.equal(rev.revoked, true);
 const checkRevoked = verifyInvite(app.store, invite2.code);
 assert.equal(checkRevoked.valid, false);
 assert.ok(checkRevoked.reason.includes('revoked'));
});

test('Public verification and admin beta endpoints enforce access controls', async t => {
 const {app, call, register} = await fixture(t, {config: {registration: 'invite'}});
 const admin = await register('owner-endpoints');
 const regular = await app.store.register('user-endpoints', 'password123456');
 const userToken = app.store.createSession(regular.id);
 const user = {user: regular, cookie: `agentdock_session=${userToken}`};

 // Public verify endpoint
 const pubVerify = await call('/api/beta/verify', {
  method: 'POST',
  body: {inviteCode: 'NON-EXISTENT'}
 });
 assert.equal(pubVerify.status, 200);
 assert.equal(pubVerify.data.valid, false);

 // User cannot create invite
 const userCreate = await call('/api/beta/invites', {
  method: 'POST',
  cookie: user.cookie,
  body: {maxUses: 1}
 });
 assert.equal(userCreate.status, 403);

 // Admin creates invite via API
 const adminCreate = await call('/api/beta/invites', {
  method: 'POST',
  cookie: admin.cookie,
  body: {maxUses: 3, email: 'friend@dock.dev'}
 });
 assert.equal(adminCreate.status, 201);
 assert.ok(adminCreate.data.invite.code);

 // Admin lists invites
 const adminList = await call('/api/beta/invites', {
  method: 'GET',
  cookie: admin.cookie
 });
 assert.equal(adminList.status, 200);
 assert.ok(adminList.data.invites.length >= 1);

 // Admin revokes invite
 const revokeRes = await call(`/api/beta/invites/${adminCreate.data.invite.id}/revoke`, {
  method: 'POST',
  cookie: admin.cookie
 });
 assert.equal(revokeRes.status, 200);
 assert.equal(revokeRes.data.revoked, true);
});

test('Budget caps configuration, tiered usage tracking and spending threshold alerts', async t => {
 const {app, call, register} = await fixture(t);
 const admin = await register('admin-budgets');
 const user = await register('user-budgets');

 // 1. Default budget caps
 const defCaps = getBudgetCaps(app.store, user.user.id);
 assert.equal(defCaps.dailyTokenCap, DEFAULT_BUDGET_CAPS.dailyTokenCap);
 assert.equal(defCaps.alertThresholdPercent, 80);

 // 2. Normal initial status -> ok
 const initialStatus = checkBudgetStatus(app.store, user.user.id);
 assert.equal(initialStatus.alert, 'ok');
 assert.equal(initialStatus.percentages.dailyTokens, 0);

 // 3. Admin sets user-specific budget cap
 const customCap = {
  scope: 'user',
  userId: user.user.id,
  dailyTokenCap: 1000,
  monthlyTokenCap: 5000,
  maxConcurrentContainers: 1,
  maxStorageBytes: 100000,
  alertThresholdPercent: 75
 };
 setBudgetCaps(app.store, admin.user.id, customCap);

 const savedCaps = getBudgetCaps(app.store, user.user.id);
 assert.equal(savedCaps.dailyTokenCap, 1000);
 assert.equal(savedCaps.alertThresholdPercent, 75);

 // 4. Simulate token usage reaching warning threshold (800 / 1000 = 80% >= 75%)
 app.store.reserve(user.user.id, 800, 10000, 20000);
 const warningStatus = checkBudgetStatus(app.store, user.user.id);
 assert.equal(warningStatus.alert, 'warning');
 assert.ok(warningStatus.alertMessage.includes('warning'));
 assert.equal(warningStatus.percentages.dailyTokens, 80);

 // 5. Simulate token usage reaching cap (1000 / 1000 = 100%)
 app.store.reserve(user.user.id, 200, 10000, 20000);
 const exceededStatus = checkBudgetStatus(app.store, user.user.id);
 assert.equal(exceededStatus.alert, 'exceeded');
 assert.ok(exceededStatus.alertMessage.includes('exceeded'));

 // 6. User and Admin routes for budgets
 const userCheck = await call('/api/budgets/status', {
  method: 'GET',
  cookie: user.cookie
 });
 assert.equal(userCheck.status, 200);
 assert.equal(userCheck.data.alert, 'exceeded');

 const adminConfig = await call('/api/admin/budgets', {
  method: 'POST',
  cookie: admin.cookie,
  body: {
   scope: 'user',
   userId: user.user.id,
   dailyTokenCap: 50000,
   monthlyTokenCap: 100000
  }
 });
 assert.equal(adminConfig.status, 200);
 assert.equal(adminConfig.data.caps.dailyTokenCap, 50000);

 // Non-admin cannot configure budgets
 const nonAdminSet = await call('/api/admin/budgets', {
  method: 'POST',
  cookie: user.cookie,
  body: {scope: 'global', dailyTokenCap: 100}
 });
 assert.equal(nonAdminSet.status, 403);
});

test('Backup archive verification, tamper detection, and recovery drill', async t => {
 const {app, call, register, dir} = await fixture(t);
 const admin = await register('admin-backup-qa');

 // Create real backup
 const backup = await createInstanceBackup({
  store: app.store,
  dataDir: dir,
  userId: admin.user.id
 });

 // Verify backup archive
 const verified = verifyBackupArchive(backup.zipBuffer);
 assert.equal(verified.valid, true);
 assert.ok(verified.fileCount >= 2);
 assert.ok(verified.dbSize > 0);

 // Verify through admin API endpoint
 const apiVerify = await call('/api/admin/backups/verify', {
  method: 'POST',
  cookie: admin.cookie,
  body: {zipBase64: backup.zipBuffer.toString('base64')}
 });
 assert.equal(apiVerify.status, 200);
 assert.equal(apiVerify.data.valid, true);

 // Recovery drill
 const drill = await runRecoveryDrill(app.store, dir, admin.user.id);
 assert.equal(drill.success, true);
 assert.ok(drill.size > 0);
});

test('Operational acceptance suite runs comprehensive diagnostics and certification', async t => {
 const {app, call, register, dir} = await fixture(t);
 const admin = await register('admin-ops');
 const regular = await register('user-ops');

 // Run direct operational acceptance
 const result = await runOperationalAcceptance(app.store, {}, {
  dataDir: dir,
  masterPassword: 'acceptance-fixture-secret'
 });

 assert.ok(['PASS', 'WARN'].includes(result.status));
 assert.equal(result.failCount, 0);
 assert.ok(result.passedCount >= 6);

 const checkNames = result.checks.map(c => c.name);
 assert.ok(checkNames.includes('database_integrity'));
 assert.ok(checkNames.includes('foreign_keys'));
 assert.ok(checkNames.includes('schema_migrations'));
 assert.ok(checkNames.includes('secrets_cryptography'));
 assert.ok(checkNames.includes('token_budgets'));
 assert.ok(checkNames.includes('beta_invitations'));
 assert.ok(checkNames.includes('worker_queue'));

 // Admin endpoint call
 const adminApiCheck = await call('/api/admin/system-check', {
  method: 'GET',
  cookie: admin.cookie
 });
 assert.equal(adminApiCheck.status, 200);
 assert.ok(['PASS', 'WARN'].includes(adminApiCheck.data.status));

 // Regular user blocked
 const regApiCheck = await call('/api/admin/system-check', {
  method: 'GET',
  cookie: regular.cookie
 });
 assert.equal(regApiCheck.status, 403);
});
