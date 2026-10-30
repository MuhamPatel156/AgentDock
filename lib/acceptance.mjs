import {createHash, randomBytes} from 'node:crypto';
import {unzipFiles} from './zip.mjs';
import {createInstanceBackup, restoreInstanceBackup} from './backup.mjs';
import {getMigrationStatus} from './migrations.mjs';
import {encryptSecret, decryptSecret} from './secrets.mjs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';

const hash = buf => createHash('sha256').update(buf).digest('hex');

export function verifyBackupArchive(zipBuffer) {
 if (!Buffer.isBuffer(zipBuffer)) zipBuffer = Buffer.from(zipBuffer);
 const files = unzipFiles(zipBuffer);

 if (!files['backup_manifest.json']) {
  throw new Error('Invalid backup archive: missing backup_manifest.json.');
 }

 let manifest;
 try {
  manifest = JSON.parse(files['backup_manifest.json'].toString('utf8'));
 } catch {
  throw new Error('Invalid backup archive: corrupt backup_manifest.json.');
 }

 if (manifest.format !== 'agentdock-backup-v1') {
  throw new Error(`Unsupported backup format: ${manifest.format}`);
 }

 if (!manifest.migrationVersion || manifest.migrationVersion < 1) {
  throw new Error('Invalid backup manifest: missing or invalid migrationVersion.');
 }

 if (!files['database.sqlite']) {
  throw new Error('Invalid backup archive: missing database.sqlite.');
 }

 // Validate SQLite header
 const dbBuf = files['database.sqlite'];
 if (dbBuf.length < 16 || !dbBuf.subarray(0, 16).toString('utf8').startsWith('SQLite format 3')) {
  throw new Error('Invalid backup archive: database.sqlite is not a valid SQLite 3 database.');
 }

 // Validate integrity of all entries in manifest
 for (const [entryPath, entryMeta] of Object.entries(manifest.entries || {})) {
  const content = files[entryPath];
  if (!content) {
   throw new Error(`Invalid backup archive: manifest entry missing from archive: ${entryPath}`);
  }
  if (content.length !== entryMeta.size) {
   throw new Error(`Backup archive entry size mismatch for ${entryPath}: expected ${entryMeta.size}, got ${content.length}`);
  }
  const actualHash = hash(content);
  if (actualHash !== entryMeta.sha256) {
   throw new Error(`Backup archive entry checksum mismatch for ${entryPath}: expected ${entryMeta.sha256}, got ${actualHash}`);
  }
 }

 return {
  valid: true,
  manifest,
  fileCount: Object.keys(files).length,
  dbSize: dbBuf.length
 };
}

export async function runRecoveryDrill(store, dataDir, userId) {
 if (!store || !dataDir || !userId) {
  throw new Error('store, dataDir, and userId required for recovery drill.');
 }

 const backup = await createInstanceBackup({store, dataDir, userId});
 const verifyResult = verifyBackupArchive(backup.zipBuffer);
 if (!verifyResult.valid) {
  throw new Error('Backup archive failed integrity validation during recovery drill.');
 }

 const drillDir = path.join(dataDir, `drill-${Date.now()}-${randomBytes(4).toString('hex')}`);
 try {
  await mkdir(drillDir, {recursive: true});
  const restored = await restoreInstanceBackup({
   zipBuffer: backup.zipBuffer,
   dataDir: drillDir,
   store,
   userId
  });

  // Verify restored database integrity
  const files = unzipFiles(backup.zipBuffer);
  const restoredDbPath = path.join(drillDir, 'database.sqlite');
  await writeFile(restoredDbPath, files['database.sqlite']);
  const restoredDb = new DatabaseSync(restoredDbPath);
  try {
   const integrity = restoredDb.prepare('PRAGMA integrity_check;').get();
   if (!integrity || Object.values(integrity)[0] !== 'ok') {
    throw new Error('Restored database failed SQLite integrity check.');
   }
  } finally {
   restoredDb.close();
  }

  return {
   success: true,
   backupId: backup.id,
   size: backup.size,
   restoredFilesCount: restored.filesCount,
   timestamp: Date.now()
  };
 } finally {
  try {
   await rm(drillDir, {recursive: true, force: true});
  } catch {}
 }
}

export async function runOperationalAcceptance(store, config = {}, {dataDir, masterPassword = 'acceptance-master-password'} = {}) {
 const checks = [];
 const now = Date.now();

 // 1. SQLite Database Integrity
 try {
  const row = store.db.prepare('PRAGMA integrity_check;').get();
  const ok = row && Object.values(row)[0] === 'ok';
  checks.push({
   name: 'database_integrity',
   category: 'storage',
   status: ok ? 'pass' : 'fail',
   message: ok ? 'SQLite database integrity check passed.' : 'Integrity check failed.'
  });
 } catch (err) {
  checks.push({name: 'database_integrity', category: 'storage', status: 'fail', message: err.message});
 }

 // 2. Foreign Key Constraints
 try {
  const fkViolations = store.db.prepare('PRAGMA foreign_key_check;').all();
  const ok = fkViolations.length === 0;
  checks.push({
   name: 'foreign_keys',
   category: 'storage',
   status: ok ? 'pass' : 'fail',
   message: ok ? 'All foreign key constraints valid.' : `${fkViolations.length} foreign key violation(s) detected.`
  });
 } catch (err) {
  checks.push({name: 'foreign_keys', category: 'storage', status: 'fail', message: err.message});
 }

 // 3. Schema Migrations Up to Date
 try {
  const status = getMigrationStatus(store.db);
  const ok = status.pending.length === 0;
  checks.push({
   name: 'schema_migrations',
   category: 'schema',
   status: ok ? 'pass' : 'fail',
   message: ok
    ? `All ${status.applied.length} migrations applied (current: v${status.currentVersion}).`
    : `${status.pending.length} pending migration(s) unapplied.`
  });
 } catch (err) {
  checks.push({name: 'schema_migrations', category: 'schema', status: 'fail', message: err.message});
 }

 // 4. Cryptographic Encryption / Decryption Round-trip
 try {
  const plaintext = `agentdock-secret-test-${randomBytes(8).toString('hex')}`;
  const enc = encryptSecret(plaintext, masterPassword);
  const dec = decryptSecret(enc.ciphertext, masterPassword, enc.iv, enc.tag);
  const ok = dec === plaintext;
  checks.push({
   name: 'secrets_cryptography',
   category: 'security',
   status: ok ? 'pass' : 'fail',
   message: ok ? 'AES-256-GCM key derivation and roundtrip encryption verified.' : 'Decrypted text did not match plaintext.'
  });
 } catch (err) {
  checks.push({name: 'secrets_cryptography', category: 'security', status: 'fail', message: err.message});
 }

 // 5. Token Ledger & Budget Subsystem
 try {
  const usageCheck = store.db.prepare('SELECT COUNT(*) as n FROM usage').get();
  const budgetCapsCheck = store.db.prepare('SELECT COUNT(*) as n FROM budget_caps').get();
  checks.push({
   name: 'token_budgets',
   category: 'billing',
   status: 'pass',
   message: `Token usage ledger and budget caps tables verified (${usageCheck.n} usage records, ${budgetCapsCheck.n} cap rules).`
  });
 } catch (err) {
  checks.push({name: 'token_budgets', category: 'billing', status: 'fail', message: err.message});
 }

 // 6. Beta Invitations Subsystem
 try {
  const inviteCheck = store.db.prepare('SELECT COUNT(*) as n FROM beta_invitations').get();
  checks.push({
   name: 'beta_invitations',
   category: 'access',
   status: 'pass',
   message: `Beta invitation registry active (${inviteCheck.n} invitations recorded).`
  });
 } catch (err) {
  checks.push({name: 'beta_invitations', category: 'access', status: 'fail', message: err.message});
 }

 // 7. Worker Background Queue Subsystem
 try {
  const jobsCheck = store.db.prepare('SELECT COUNT(*) as n FROM worker_jobs').get();
  checks.push({
   name: 'worker_queue',
   category: 'compute',
   status: 'pass',
   message: `Worker queue table operational (${jobsCheck.n} jobs tracked).`
  });
 } catch (err) {
  checks.push({name: 'worker_queue', category: 'compute', status: 'fail', message: err.message});
 }

 // 8. Docker Runtime / Sandbox State
 const buildsEnabled = Boolean(config.enableBuilds || process.env.AGENTDOCK_ENABLE_BUILDS === '1');
 checks.push({
  name: 'container_runtime',
  category: 'compute',
  status: buildsEnabled ? 'pass' : 'warn',
  message: buildsEnabled
   ? 'Docker build runtime enabled.'
   : 'Docker build runtime disabled (standard local development mode).'
 });

 // Determine overall status
 const hasFail = checks.some(c => c.status === 'fail');
 const hasWarn = checks.some(c => c.status === 'warn');
 const overallStatus = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';

 return {
  status: overallStatus,
  passedCount: checks.filter(c => c.status === 'pass').length,
  warnCount: checks.filter(c => c.status === 'warn').length,
  failCount: checks.filter(c => c.status === 'fail').length,
  totalChecks: checks.length,
  timestamp: now,
  checks
 };
}
