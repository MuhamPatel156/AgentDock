import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, workspace} from './helpers.mjs';
import {
 detectDeploymentTarget,
 verifyDomainName,
 createDeployment,
 listDeployments,
 rollbackDeployment
} from '../lib/deployment.mjs';

test('detectDeploymentTarget recognizes python, node, and static projects', () => {
 assert.equal(detectDeploymentTarget({'app.py': 'print(1)'}).runtime, 'python');
 assert.equal(detectDeploymentTarget({'main.py': 'print(1)'}).runtime, 'python');
 assert.equal(detectDeploymentTarget({'server.mjs': 'export default 1'}).runtime, 'node');
 assert.equal(detectDeploymentTarget({'package.json': '{}'}).runtime, 'node');
 assert.equal(detectDeploymentTarget({'index.html': '<h1>Hi</h1>'}).runtime, 'static');
});

test('verifyDomainName validates standard domain format and normalizes case', () => {
 assert.equal(verifyDomainName('My-Site.example.com'), 'my-site.example.com');
 assert.equal(verifyDomainName('app.io'), 'app.io');

 assert.throws(() => verifyDomainName(''), /required/);
 assert.throws(() => verifyDomainName('bad domain with spaces.com'), /format/);
 assert.throws(() => verifyDomainName('-leading-hyphen.com'), /format/);
});

test('createDeployment supports local and signed webhook deployments', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('deploy-user', 'password123456');
 const proj = 'proj-dep-1';

 const files = {'index.html': '<!doctype html><title>Deploy Test</title>'};

 // 1. Local release deployment
 const depLocal = await createDeployment({
  store: app.store,
  userId: user.id,
  projectId: proj,
  target: 'local',
  files
 });

 assert.equal(depLocal.target, 'local');
 assert.equal(depLocal.status, 'active');
 assert.ok(depLocal.url.startsWith('/releases/'));

 // 2. Webhook deployment
 const mockWebhookTransport = async (url, opts) => {
  assert.ok(opts.headers['X-AgentDock-Signature']);
  return {
   ok: true,
   json: async () => ({url: 'https://preview.mycloud.invalid/app-1'})
  };
 };

 const depWebhook = await createDeployment({
  store: app.store,
  userId: user.id,
  projectId: proj,
  target: 'webhook',
  files,
  webhookUrl: 'https://webhook.invalid/deploy',
  webhookSecret: 'secret-key-123',
  transport: mockWebhookTransport
 });

 assert.equal(depWebhook.target, 'webhook');
 assert.equal(depWebhook.status, 'active');
 assert.equal(depWebhook.url, 'https://preview.mycloud.invalid/app-1');

 // Earlier deployment is now inactive
 const list = listDeployments(app.store, user.id, proj);
 assert.equal(list.length, 2);
 const oldLocal = list.find(d => d.id === depLocal.id);
 assert.equal(oldLocal.status, 'inactive');
});

test('rollbackDeployment restores previous file snapshot and marks rolled_back', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('rollback-user', 'password123456');
 const proj = 'proj-rollback';

 const filesV1 = {'index.html': '<h1>Version 1</h1>'};
 const filesV2 = {'index.html': '<h1>Version 2</h1>'};

 const dep1 = await createDeployment({store: app.store, userId: user.id, projectId: proj, target: 'local', files: filesV1});
 const dep2 = await createDeployment({store: app.store, userId: user.id, projectId: proj, target: 'local', files: filesV2});

 assert.equal(dep2.status, 'active');

 // Rollback to dep1
 const rolled = await rollbackDeployment({
  store: app.store,
  userId: user.id,
  projectId: proj,
  targetDeploymentId: dep1.id
 });

 assert.equal(rolled.status, 'active');
 assert.equal(rolled.restoredFrom, dep1.id);
 assert.ok(rolled.version.startsWith('rollback-'));

 // dep2 is now marked rolled_back
 const list = listDeployments(app.store, user.id, proj);
 const oldDep2 = list.find(d => d.id === dep2.id);
 assert.equal(oldDep2.status, 'rolled_back');
});

test('HTTP API routes for deployments, rollback, and custom domains work end-to-end', async t => {
 const {call, register} = await fixture(t);
 const user = await register('deploy-api-user');
 const proj = 'proj-http-deploy';

 // Save project workspace first
 await call('/api/workspace', {
  method: 'PUT',
  cookie: user.cookie,
  body: {
   revision: 0,
   state: {
    projects: [{id: proj, name: 'Deploy Project', files: {'index.html': '<!doctype html><title>V1</title>'}, checkpoints: []}],
    active: proj,
    history: [],
    components: [],
    settings: {dailyLimit: 12000, outputLimit: 512}
   }
  }
 });

 // 1. Trigger local deployment
 const depRes = await call(`/api/projects/${proj}/deploy`, {
  method: 'POST',
  cookie: user.cookie,
  body: {target: 'local'}
 });
 assert.equal(depRes.status, 200);
 assert.equal(depRes.data.status, 'active');
 const dep1Id = depRes.data.id;

 // 2. List deployments
 const listRes = await call(`/api/projects/${proj}/deployments`, {cookie: user.cookie});
 assert.equal(listRes.status, 200);
 assert.equal(listRes.data.deployments.length, 1);

 // 3. Rollback deployment
 const rollbackRes = await call(`/api/projects/${proj}/deployments/${dep1Id}/rollback`, {
  method: 'POST',
  cookie: user.cookie
 });
 assert.equal(rollbackRes.status, 200);
 assert.equal(rollbackRes.data.status, 'active');
 assert.equal(rollbackRes.data.restoredFrom, dep1Id);

 // 4. Custom domains API
 const addDom = await call(`/api/projects/${proj}/domains`, {
  method: 'POST',
  cookie: user.cookie,
  body: {domain: 'mysite.custom.org'}
 });
 assert.equal(addDom.status, 200);
 assert.equal(addDom.data.domain, 'mysite.custom.org');
 assert.equal(addDom.data.verified, true);

 const listDom = await call(`/api/projects/${proj}/domains`, {cookie: user.cookie});
 assert.equal(listDom.status, 200);
 assert.equal(listDom.data.domains.length, 1);

 const delDom = await call(`/api/projects/${proj}/domains/mysite.custom.org`, {
  method: 'DELETE',
  cookie: user.cookie
 });
 assert.equal(delDom.status, 200);
 assert.equal(delDom.data.ok, true);
});
