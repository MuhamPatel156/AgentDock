import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, workspace} from './helpers.mjs';
import {
 getGitHubAuthUrl,
 exchangeGitHubCode,
 getGitHubUser,
 listUserRepositories,
 verifyRepository,
 pushScopedProject
} from '../lib/github-oauth.mjs';

test('getGitHubAuthUrl builds proper OAuth URL with requested scopes', () => {
 const url = getGitHubAuthUrl({
  clientId: 'client-123',
  redirectUri: 'http://127.0.0.1:4173/api/github/callback',
  state: 'xyz-state'
 });
 assert.ok(url.startsWith('https://github.com/login/oauth/authorize?'));
 assert.ok(url.includes('client_id=client-123'));
 assert.ok(url.includes('redirect_uri=http%3A%2F%2F127.0.0.1%3A4173%2Fapi%2Fgithub%2Fcallback'));
 assert.ok(url.includes('scope=repo%2Cread%3Auser'));
 assert.ok(url.includes('state=xyz-state'));
});

test('exchangeGitHubCode exchanges authorization code for access token', async () => {
 const mockTransport = async (url, opts) => {
  const body = JSON.parse(opts.body);
  assert.equal(body.client_id, 'test-id');
  assert.equal(body.code, 'valid-code');
  return {
   ok: true,
   json: async () => ({
    access_token: 'gho_mock_access_token_12345',
    token_type: 'bearer',
    scope: 'repo,read:user'
   })
  };
 };

 const res = await exchangeGitHubCode({
  clientId: 'test-id',
  clientSecret: 'test-secret',
  code: 'valid-code',
  redirectUri: 'http://127.0.0.1:4173/callback',
  transport: mockTransport
 });

 assert.equal(res.accessToken, 'gho_mock_access_token_12345');
 assert.equal(res.tokenType, 'bearer');
 assert.equal(res.scope, 'repo,read:user');
});

test('getGitHubUser and listUserRepositories parse profiles and permissions', async () => {
 const mockTransport = async url => {
  if (url.endsWith('/user')) {
   return {
    ok: true,
    json: async () => ({login: 'octocat', id: 1, name: 'The Octocat', avatar_url: 'https://avatar.invalid/1'})
   };
  }
  if (url.includes('/user/repos')) {
   return {
    ok: true,
    json: async () => [
     {name: 'repo-1', full_name: 'octocat/repo-1', private: false, default_branch: 'main', permissions: {push: true}}
    ]
   };
  }
  return {ok: false, status: 404};
 };

 const user = await getGitHubUser({accessToken: 'mock-token', transport: mockTransport});
 assert.equal(user.login, 'octocat');
 assert.equal(user.name, 'The Octocat');

 const repos = await listUserRepositories({accessToken: 'mock-token', transport: mockTransport});
 assert.equal(repos.length, 1);
 assert.equal(repos[0].fullName, 'octocat/repo-1');
 assert.equal(repos[0].permissions.push, true);
});

test('verifyRepository checks branch existence and push permissions', async () => {
 const mockTransport = async url => {
  if (url.endsWith('/repos/octocat/repo-1')) {
   return {
    ok: true,
    json: async () => ({full_name: 'octocat/repo-1', default_branch: 'main', permissions: {push: true}})
   };
  }
  if (url.endsWith('/branches/main')) {
   return {
    ok: true,
    json: async () => ({name: 'main', commit: {sha: 'c0ffee123456789'}})
   };
  }
  return {ok: false, status: 404};
 };

 const res = await verifyRepository({
  accessToken: 'mock-token',
  repository: 'octocat/repo-1',
  branch: 'main',
  transport: mockTransport
 });

 assert.equal(res.verified, true);
 assert.equal(res.hasPushPermission, true);
 assert.equal(res.headSha, 'c0ffee123456789');
});

test('pushScopedProject creates commits and updates ref without force pushing', async () => {
 const calls = [];
 const mockTransport = async (url, opts) => {
  calls.push({url, method: opts.method || 'GET'});
  if (url.endsWith('/git/ref/heads/main')) {
   return {ok: true, json: async () => ({object: {sha: 'base-sha-111'}})};
  }
  if (url.endsWith('/git/commits/base-sha-111')) {
   return {ok: true, json: async () => ({tree: {sha: 'base-tree-sha'}})};
  }
  if (url.endsWith('/git/trees')) {
   return {ok: true, json: async () => ({sha: 'new-tree-sha'})};
  }
  if (url.endsWith('/git/commits')) {
   return {ok: true, json: async () => ({sha: 'new-commit-sha'})};
  }
  if (url.endsWith('/git/refs/heads/main') && opts.method === 'PATCH') {
   const body = JSON.parse(opts.body);
   assert.equal(body.force, false);
   assert.equal(body.sha, 'new-commit-sha');
   return {ok: true, json: async () => ({})};
  }
  return {ok: false, status: 400};
 };

 const files = {'index.html': '<!doctype html><title>Test</title>'};
 const res = await pushScopedProject({
  accessToken: 'mock-token',
  repository: 'octocat/repo-1',
  branch: 'main',
  message: 'First push',
  files,
  transport: mockTransport
 });

 assert.equal(res.sha, 'new-commit-sha');
 assert.ok(res.url.includes('octocat/repo-1/commit/new-commit-sha'));
});

test('Store persists encrypted GitHub credentials and per-project repos', async t => {
 const {app} = await fixture(t);
 const user = await app.store.register('gh-store-user', 'password123456');
 const master = 'master-secret-key';

 // Save GitHub account
 const saved = app.store.setGitHubAccount(user.id, 'octocat', 'gho_token_123', 'repo', master);
 assert.equal(saved.githubUser, 'octocat');

 // Retrieve without master password (token is masked/null)
 const masked = app.store.getGitHubAccount(user.id);
 assert.equal(masked.githubUser, 'octocat');
 assert.equal(masked.token, null);

 // Retrieve with master password
 const full = app.store.getGitHubAccount(user.id, master);
 assert.equal(full.token, 'gho_token_123');

 // Save project repository association
 app.store.setProjectRepo(user.id, 'proj-1', 'octocat/my-app', 'main', 1);
 const projRepo = app.store.getProjectRepo(user.id, 'proj-1');
 assert.equal(projRepo.repository, 'octocat/my-app');
 assert.equal(projRepo.branch, 'main');
 assert.equal(projRepo.verified, true);

 // Delete account
 const deleted = app.store.deleteGitHubAccount(user.id);
 assert.equal(deleted, true);
 assert.equal(app.store.getGitHubAccount(user.id), null);
});

test('HTTP API routes for GitHub OAuth, connect, verify and push work end-to-end', async t => {
 const mockTransport = async (url, opts = {}) => {
  if (url.endsWith('/repos/octocat/test-app')) {
   return {ok: true, json: async () => ({permissions: {push: true}, default_branch: 'main'})};
  }
  if (url.endsWith('/branches/main')) {
   return {ok: true, json: async () => ({name: 'main', commit: {sha: 'head-sha-123'}})};
  }
  if (url.endsWith('/git/ref/heads/main')) {
   return {ok: true, json: async () => ({object: {sha: 'head-sha-123'}})};
  }
  if (url.endsWith('/git/commits/head-sha-123')) {
   return {ok: true, json: async () => ({tree: {sha: 'tree-sha-123'}})};
  }
  if (url.endsWith('/git/trees')) {
   return {ok: true, json: async () => ({sha: 'new-tree-sha'})};
  }
  if (url.endsWith('/git/commits')) {
   return {ok: true, json: async () => ({sha: 'commit-sha-456'})};
  }
  if (url.endsWith('/git/refs/heads/main')) {
   return {ok: true, json: async () => ({})};
  }
  return {ok: false, status: 404};
 };

 const {call, register} = await fixture(t, {transport: mockTransport});
 const member = await register('gh-member');

 // 1. Auth URL
 const authUrl = await call('/api/github/auth-url', {cookie: member.cookie});
 assert.equal(authUrl.status, 200);
 assert.ok(authUrl.data.url.includes('github.com/login/oauth/authorize'));

 // 2. Connect GitHub account
 const connectRes = await call('/api/github/connect', {
  method: 'POST',
  cookie: member.cookie,
  body: {githubUser: 'octocat', token: 'mock-gh-token', scopes: 'repo'}
 });
 assert.equal(connectRes.status, 200);
 assert.equal(connectRes.data.githubUser, 'octocat');

 // 3. Inspect account
 const accRes = await call('/api/github/account', {cookie: member.cookie});
 assert.equal(accRes.status, 200);
 assert.equal(accRes.data.account.githubUser, 'octocat');

 // Save workspace project first
 await call('/api/workspace', {
  method: 'PUT',
  cookie: member.cookie,
  body: {
   revision: 0,
   state: workspace({'index.html': '<!doctype html><title>App</title>'})
  }
 });

 // 4. Verify repository
 const verifyRes = await call('/api/github/verify-repo', {
  method: 'POST',
  cookie: member.cookie,
  body: {projectId: 'project-1', repository: 'octocat/test-app', branch: 'main'}
 });
 assert.equal(verifyRes.status, 200);
 assert.equal(verifyRes.data.verified, true);
 assert.equal(verifyRes.data.hasPushPermission, true);

 // 5. Push scoped project
 const pushRes = await call('/api/projects/github/push-scoped', {
  method: 'POST',
  cookie: member.cookie,
  body: {
   projectId: 'project-1',
   repository: 'octocat/test-app',
   branch: 'main',
   confirm: true,
   message: 'Scoped push from AgentDock'
  }
 });
 assert.equal(pushRes.status, 200);
 assert.equal(pushRes.data.sha, 'commit-sha-456');
 assert.ok(pushRes.data.url.includes('commit-sha-456'));
});
