import {randomUUID, createHmac} from 'node:crypto';
import {validateFiles} from '../dist/core.mjs';

export function detectDeploymentTarget(files) {
 if (files['app.py'] || files['main.py']) {
  return {
   runtime: 'python',
   entry: files['app.py'] ? 'app.py' : 'main.py',
   kind: 'python-web'
  };
 }
 if (files['server.mjs'] || files['package.json']) {
  return {
   runtime: 'node',
   entry: files['server.mjs'] ? 'server.mjs' : 'index.js',
   kind: 'node-web'
  };
 }
 return {
  runtime: 'static',
  entry: 'index.html',
  kind: 'static-site'
 };
}

export function verifyDomainName(domain) {
 if (!domain || typeof domain !== 'string') throw Error('Domain string required.');
 const clean = domain.trim().toLowerCase();
 if (clean.length > 253) throw Error('Domain name exceeds 253 characters.');
 if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(clean)) {
  throw Error('Invalid domain name format.');
 }
 return clean;
}

export async function createDeployment({
 store,
 userId,
 projectId,
 target = 'local',
 files,
 webhookUrl = null,
 webhookSecret = null,
 transport = fetch
}) {
 if (!store || !userId || !projectId) throw Error('Store, userId, and projectId required.');
 const validated = validateFiles(files);
 const id = randomUUID(), now = Date.now();
 const version = `v${now}`;
 const filesJson = JSON.stringify(validated);

 let deploymentUrl = null;
 let initialStatus = 'active';

 if (target === 'local') {
  const releaseId = store.release(userId, `Deploy ${version}`, validated);
  deploymentUrl = `/releases/${releaseId}/index.html`;
 } else if (target === 'webhook') {
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) throw Error('Valid HTTP/HTTPS webhook URL required.');
  const payload = {
   event: 'deploy',
   projectId,
   version,
   files: Object.keys(validated),
   timestamp: now
  };
  const body = JSON.stringify(payload);
  const headers = {
   'Content-Type': 'application/json',
   'User-Agent': 'AgentDock-Studio'
  };
  if (webhookSecret) {
   const sig = createHmac('sha256', webhookSecret).update(body).digest('hex');
   headers['X-AgentDock-Signature'] = `sha256=${sig}`;
  }
  const r = await transport(webhookUrl, {method: 'POST', headers, body});
  if (!r.ok) throw Error(`Deployment webhook responded with HTTP ${r.status}`);
  const resData = await r.json().catch(() => ({}));
  deploymentUrl = resData.url || webhookUrl;
 } else {
  throw Error(`Unsupported deployment target: ${target}`);
 }

 // Deactivate any previously active deployment for this project
 store.db.prepare(
  "UPDATE deployments SET status='inactive', updated=? WHERE user_id=? AND project_id=? AND status='active'"
 ).run(now, userId, projectId);

 store.db.prepare(
  'INSERT INTO deployments (id, user_id, project_id, target, version, status, url, files_snapshot, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
 ).run(id, userId, projectId, target, version, initialStatus, deploymentUrl, filesJson, now, now);

 return {
  id,
  projectId,
  target,
  version,
  status: initialStatus,
  url: deploymentUrl,
  created: now
 };
}

export function listDeployments(store, userId, projectId) {
 return store.db.prepare(
  'SELECT id, project_id, target, version, status, url, created, updated FROM deployments WHERE user_id=? AND project_id=? ORDER BY created DESC LIMIT 50'
 ).all(userId, projectId);
}

export function getDeployment(store, userId, deploymentId) {
 const row = store.db.prepare('SELECT * FROM deployments WHERE id=? AND user_id=?').get(deploymentId, userId);
 if (!row) return null;
 return {
  ...row,
  files: JSON.parse(row.files_snapshot)
 };
}

export async function rollbackDeployment({store, userId, projectId, targetDeploymentId}) {
 const historical = getDeployment(store, userId, targetDeploymentId);
 if (!historical || historical.project_id !== projectId) {
  throw Error('Historical deployment unavailable for rollback.');
 }

 const now = Date.now();
 const newVersion = `rollback-${historical.version}-${now}`;

 // Set current active deployment to rolled_back
 store.db.prepare(
  "UPDATE deployments SET status='rolled_back', updated=? WHERE user_id=? AND project_id=? AND status='active'"
 ).run(now, userId, projectId);

 let deploymentUrl = historical.url;
 if (historical.target === 'local') {
  const releaseId = store.release(userId, `Rollback to ${historical.version}`, historical.files);
  deploymentUrl = `/releases/${releaseId}/index.html`;
 }

 const newId = randomUUID();
 store.db.prepare(
  'INSERT INTO deployments (id, user_id, project_id, target, version, status, url, files_snapshot, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
 ).run(newId, userId, projectId, historical.target, newVersion, 'active', deploymentUrl, JSON.stringify(historical.files), now, now);

 return {
  id: newId,
  projectId,
  target: historical.target,
  version: newVersion,
  status: 'active',
  url: deploymentUrl,
  restoredFrom: historical.id,
  created: now
 };
}
