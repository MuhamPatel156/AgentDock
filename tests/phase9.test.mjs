import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {RateLimiter, generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey, securityHeaders} from '../lib/security.mjs';

test('RateLimiter enforces attempts and sliding expiration window', () => {
 const limiter = new RateLimiter({maxAttempts: 3, windowMs: 1000});
 assert.equal(limiter.check('ip-1').allowed, true);
 assert.equal(limiter.check('ip-1').allowed, true);
 assert.equal(limiter.check('ip-1').allowed, true);

 const blocked = limiter.check('ip-1');
 assert.equal(blocked.allowed, false);
 assert.ok(blocked.retryAfter > 0);

 // Different key is not blocked
 assert.equal(limiter.check('ip-2').allowed, true);

 limiter.reset('ip-1');
 assert.equal(limiter.check('ip-1').allowed, true);
});

test('Emergency Recovery Keys generate valid entropy, hash securely and verify', async () => {
 const key = generateRecoveryKey();
 assert.match(key, /^AD-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

 const hashed = await hashRecoveryKey(key);
 assert.ok(hashed.includes(':'));

 const match = await verifyRecoveryKey(key, hashed);
 assert.equal(match, true);

 const badMatch = await verifyRecoveryKey('AD-0000-0000-0000-0000', hashed);
 assert.equal(badMatch, false);
});

test('Security headers include HSTS when TLS active and frame options', () => {
 const stdHeaders = securityHeaders({isHttps: false});
 assert.equal(stdHeaders['X-Content-Type-Options'], 'nosniff');
 assert.equal(stdHeaders['X-Frame-Options'], 'DENY');
 assert.equal(stdHeaders['Strict-Transport-Security'], undefined);

 const httpsHeaders = securityHeaders({isHttps: true});
 assert.ok(httpsHeaders['Strict-Transport-Security'].includes('max-age=31536000'));
});

test('Store password reset tokens expire, are single-use, and revoke old sessions', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('reset-user', 'old-password-1234');
 const oldSession = app.store.createSession(user.id);
 assert.ok(app.store.session(oldSession));

 // Create reset token
 const {resetToken, expires} = app.store.createPasswordReset('reset-user');
 assert.ok(resetToken);
 assert.ok(expires > Date.now());

 // Reset password
 const res = await app.store.resetPassword(resetToken, 'new-password-1234');
 assert.equal(res.ok, true);

 // Old session is invalidated
 assert.equal(app.store.session(oldSession), null);

 // User can log in with new password
 const loggedIn = await app.store.login('reset-user', 'new-password-1234');
 assert.equal(loggedIn.id, user.id);

 // Used reset token cannot be reused
 await assert.rejects(
  () => app.store.resetPassword(resetToken, 'another-password-12'),
  /Invalid or expired password reset token/
 );
});

test('Emergency recovery key resets password and invalidates active sessions', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('rec-user', 'initial-password-12');
 const oldSession = app.store.createSession(user.id);

 const recKey = generateRecoveryKey();
 const recHash = await hashRecoveryKey(recKey);
 app.store.setRecoveryKey(user.id, recHash);

 // Reset using recovery key
 const res = await app.store.resetPasswordWithRecovery('rec-user', recKey, 'recovered-password-12');
 assert.equal(res.ok, true);

 // Old session is revoked
 assert.equal(app.store.session(oldSession), null);

 // Can log in with new password
 const u = await app.store.login('rec-user', 'recovered-password-12');
 assert.equal(u.id, user.id);
});

test('HTTP API routes for password recovery, reset, and session revocation work end-to-end', async t => {
 const {call, register} = await fixture(t);
 const account = await register('http-sec-user');

 // Generate emergency recovery key
 const keyRes = await call('/api/auth/recovery-key', {method: 'POST', cookie: account.cookie});
 assert.equal(keyRes.status, 200);
 assert.ok(keyRes.data.recoveryKey);

 // List sessions
 const sessRes = await call('/api/auth/sessions', {cookie: account.cookie});
 assert.equal(sessRes.status, 200);
 assert.ok(sessRes.data.sessions.length >= 1);

 // Revoke all sessions
 const revokeRes = await call('/api/auth/sessions/revoke-all', {method: 'POST', cookie: account.cookie});
 assert.equal(revokeRes.status, 200);
 assert.ok(revokeRes.headers['Set-Cookie']);

 // Request password reset token
 const reqToken = await call('/api/auth/reset-request', {
  method: 'POST',
  body: {username: 'http-sec-user'}
 });
 assert.equal(reqToken.status, 200);
 assert.ok(reqToken.data.resetToken);

 // Reset password via API
 const resetRes = await call('/api/auth/reset-password', {
  method: 'POST',
  body: {token: reqToken.data.resetToken, newPassword: 'brand-new-password-123'}
 });
 assert.equal(resetRes.status, 200);
 assert.equal(resetRes.data.ok, true);

 // Login with new password succeeds
 const loginNew = await call('/api/auth/login', {
  method: 'POST',
  body: {username: 'http-sec-user', password: 'brand-new-password-123'}
 });
 assert.equal(loginNew.status, 200);
 assert.equal(loginNew.data.user.username, 'http-sec-user');

 // Recover with recovery key via API
 const recApiRes = await call('/api/auth/recover-with-key', {
  method: 'POST',
  body: {
   username: 'http-sec-user',
   recoveryKey: keyRes.data.recoveryKey,
   newPassword: 'key-recovered-password-123'
  }
 });
 assert.equal(recApiRes.status, 200);
 assert.equal(recApiRes.data.ok, true);
});
