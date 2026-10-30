import {randomBytes, randomUUID} from 'node:crypto';

export function generateInviteCode() {
 const part1 = randomBytes(2).toString('hex').toUpperCase();
 const part2 = randomBytes(2).toString('hex').toUpperCase();
 return `BETA-${part1}-${part2}`;
}

export function createInvite(store, adminUserId, {email = null, maxUses = 1, expiresInHours = 168} = {}) {
 const adminUser = store.db.prepare('SELECT admin FROM users WHERE id=?').get(adminUserId);
 if (!adminUser || !adminUser.admin) {
  const err = new Error('Admin permission required to create beta invitations.');
  err.status = 403;
  throw err;
 }

 if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
  throw new Error('Invalid email address format.');
 }

 const parsedMaxUses = parseInt(maxUses, 10);
 if (isNaN(parsedMaxUses) || parsedMaxUses < 1) {
  throw new Error('maxUses must be at least 1.');
 }

 const expires = expiresInHours ? Date.now() + (expiresInHours * 3600 * 1000) : null;
 const code = generateInviteCode();
 const id = randomUUID();
 const now = Date.now();

 store.db.prepare(`
  INSERT INTO beta_invitations (id, code, invited_email, created_by, max_uses, use_count, expires, revoked, created)
  VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)
 `).run(id, code, email ? email.trim().toLowerCase() : null, adminUserId, parsedMaxUses, expires, now);

 return {
  id,
  code,
  invited_email: email ? email.trim().toLowerCase() : null,
  max_uses: parsedMaxUses,
  use_count: 0,
  expires,
  revoked: false,
  created: now,
  active: true
 };
}

export function listInvites(store, adminUserId) {
 const adminUser = store.db.prepare('SELECT admin FROM users WHERE id=?').get(adminUserId);
 if (!adminUser || !adminUser.admin) {
  const err = new Error('Admin permission required to view beta invitations.');
  err.status = 403;
  throw err;
 }

 const rows = store.db.prepare('SELECT * FROM beta_invitations ORDER BY created DESC').all();
 const now = Date.now();

 return rows.map(r => ({
  id: r.id,
  code: r.code,
  invited_email: r.invited_email,
  created_by: r.created_by,
  max_uses: r.max_uses,
  use_count: r.use_count,
  expires: r.expires,
  revoked: Boolean(r.revoked),
  created: r.created,
  active: Boolean(!r.revoked && (!r.expires || r.expires > now) && r.use_count < r.max_uses)
 }));
}

export function revokeInvite(store, adminUserId, inviteId) {
 const adminUser = store.db.prepare('SELECT admin FROM users WHERE id=?').get(adminUserId);
 if (!adminUser || !adminUser.admin) {
  const err = new Error('Admin permission required to revoke beta invitations.');
  err.status = 403;
  throw err;
 }

 const res = store.db.prepare('UPDATE beta_invitations SET revoked=1 WHERE id=?').run(inviteId);
 if (!res.changes) {
  const err = new Error('Invitation not found.');
  err.status = 404;
  throw err;
 }

 return {revoked: true, id: inviteId};
}

export function verifyInvite(store, code, configInviteCode = null) {
 if (!code || typeof code !== 'string') {
  return {valid: false, reason: 'Invitation code required.'};
 }

 const trimmed = code.trim();
 if (configInviteCode && trimmed === configInviteCode) {
  return {valid: true, type: 'config'};
 }

 const row = store.db.prepare('SELECT * FROM beta_invitations WHERE code=?').get(trimmed);
 if (!row) {
  return {valid: false, reason: 'Invalid invitation code.'};
 }

 if (row.revoked) {
  return {valid: false, reason: 'Invitation has been revoked.'};
 }

 if (row.expires && row.expires <= Date.now()) {
  return {valid: false, reason: 'Invitation has expired.'};
 }

 if (row.use_count >= row.max_uses) {
  return {valid: false, reason: 'Invitation has reached maximum uses.'};
 }

 return {
  valid: true,
  type: 'db',
  invite: {
   id: row.id,
   code: row.code,
   invited_email: row.invited_email,
   max_uses: row.max_uses,
   use_count: row.use_count,
   expires: row.expires
  }
 };
}

export function claimInvite(store, code, newUserId, configInviteCode = null) {
 if (!code || typeof code !== 'string') {
  throw new Error('Invitation code required.');
 }

 const trimmed = code.trim();
 if (configInviteCode && trimmed === configInviteCode) {
  return {claimed: true, type: 'config'};
 }

 store.db.exec('BEGIN IMMEDIATE');
 try {
  const row = store.db.prepare('SELECT * FROM beta_invitations WHERE code=?').get(trimmed);
  if (!row) {
   const err = new Error('Invalid invitation code.');
   err.status = 403;
   throw err;
  }
  if (row.revoked) {
   const err = new Error('Invitation has been revoked.');
   err.status = 403;
   throw err;
  }
  if (row.expires && row.expires <= Date.now()) {
   const err = new Error('Invitation has expired.');
   err.status = 403;
   throw err;
  }
  if (row.use_count >= row.max_uses) {
   const err = new Error('Invitation has reached maximum uses.');
   err.status = 403;
   throw err;
  }

  store.db.prepare('UPDATE beta_invitations SET use_count = use_count + 1 WHERE id=?').run(row.id);
  store.db.prepare('INSERT INTO beta_claims (id, invitation_id, user_id, claimed_at) VALUES (?, ?, ?, ?)').run(
   randomUUID(),
   row.id,
   newUserId,
   Date.now()
  );
  store.db.exec('COMMIT');

  return {claimed: true, type: 'db', invitationId: row.id};
 } catch (e) {
  store.db.exec('ROLLBACK');
  throw e;
 }
}
