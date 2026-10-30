import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile, rm, lstat, readdir} from 'node:fs/promises';
import path from 'node:path';
import {zipFiles, unzipFiles} from './zip.mjs';
import {getMigrationStatus} from './migrations.mjs';

const hash = buf => createHash('sha256').update(buf).digest('hex');

export async function createInstanceBackup({store, dataDir, userId}) {
 if (!store || !dataDir || !userId) throw Error('Store, dataDir, and userId are required to create a backup.');

 const files = {};
 const manifest = {
  format: 'agentdock-backup-v1',
  version: '0.2.0',
  timestamp: Date.now(),
  userId,
  migrationVersion: getMigrationStatus(store.db).currentVersion,
  entries: {}
 };

 // 1. Snapshot database using VACUUM INTO
 const tempDb = path.join(dataDir, `backup-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`);
 try {
  store.db.exec(`VACUUM INTO '${tempDb.replaceAll('\\', '/')}';`);
  const dbContent = await readFile(tempDb);
  files['database.sqlite'] = dbContent;
  manifest.entries['database.sqlite'] = {
   size: dbContent.length,
   sha256: hash(dbContent)
  };
 } finally {
  try { await rm(tempDb, {force: true}); } catch {}
 }

 // 2. Collect project files and databases from dataDir
 const userProjectsDir = path.join(dataDir, 'projects', userId);
 try {
  const stat = await lstat(userProjectsDir);
  if (stat.isDirectory()) {
   async function walk(dir, prefix) {
    const entries = await readdir(dir, {withFileTypes: true});
    for (const ent of entries) {
     if (ent.name.startsWith('.') || ent.isSymbolicLink()) continue;
     const full = path.join(dir, ent.name);
     const rel = (prefix ? prefix + '/' : '') + ent.name;
     if (ent.isDirectory()) {
      await walk(full, rel);
     } else if (ent.isFile()) {
      const content = await readFile(full);
      const zipPath = 'projects/' + rel;
      files[zipPath] = content;
      manifest.entries[zipPath] = {
       size: content.length,
       sha256: hash(content)
      };
     }
    }
   }
   await walk(userProjectsDir, '');
  }
 } catch (err) {
  if (err.code !== 'ENOENT') throw err;
 }

 // 3. Embed manifest
 const manifestJson = JSON.stringify(manifest, null, 2);
 files['backup_manifest.json'] = manifestJson;

 const zipBuffer = zipFiles(files);
 const zipSha256 = hash(zipBuffer);
 const filename = `agentdock-backup-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString('hex')}.zip`;

 const backupId = randomUUID();
 store.recordBackup(backupId, userId, filename, zipBuffer.length, zipSha256, manifest.migrationVersion);

 return {
  id: backupId,
  filename,
  size: zipBuffer.length,
  sha256: zipSha256,
  manifest,
  zipBuffer
 };
}

export async function restoreInstanceBackup({zipBuffer, dataDir, store, userId}) {
 if (!Buffer.isBuffer(zipBuffer)) zipBuffer = Buffer.from(zipBuffer);
 const files = unzipFiles(zipBuffer);

 if (!files['backup_manifest.json']) {
  throw Error('Invalid backup archive: missing backup_manifest.json.');
 }

 let manifest;
 try {
  manifest = JSON.parse(files['backup_manifest.json'].toString('utf8'));
 } catch {
  throw Error('Invalid backup archive: corrupt backup_manifest.json.');
 }

 if (manifest.format !== 'agentdock-backup-v1') {
  throw Error('Unsupported backup format: ' + manifest.format);
 }

 // Verify all entry checksums
 for (const [entryPath, meta] of Object.entries(manifest.entries || {})) {
  const content = files[entryPath];
  if (!content) {
   throw Error(`Corrupt backup: missing declared file ${entryPath}`);
  }
  const fileHash = hash(content);
  if (fileHash !== meta.sha256) {
   throw Error(`Corrupt backup: checksum mismatch for ${entryPath}`);
  }
 }

 // Restore persistent files and project databases
 let restoredCount = 0;
 for (const [entryPath, content] of Object.entries(files)) {
  if (entryPath === 'backup_manifest.json' || entryPath === 'database.sqlite') continue;
  if (!entryPath.startsWith('projects/')) continue;

  const targetPath = path.resolve(dataDir, 'projects', userId, entryPath.slice('projects/'.length));
  const expectedBase = path.resolve(dataDir, 'projects', userId);
  if (!targetPath.startsWith(expectedBase + path.sep) && targetPath !== expectedBase) {
   throw Error('Path traversal detected in backup: ' + entryPath);
  }

  await mkdir(path.dirname(targetPath), {recursive: true});
  await writeFile(targetPath, content);
  restoredCount++;
 }

 return {
  restored: true,
  filesCount: restoredCount,
  timestamp: manifest.timestamp,
  migrationVersion: manifest.migrationVersion
 };
}
