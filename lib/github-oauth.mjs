import {hasSecrets} from './agents.mjs';

export function getGitHubAuthUrl({clientId, redirectUri, state, scopes = 'repo,read:user'}) {
 if (!clientId) throw Error('GitHub Client ID is required.');
 const params = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  state: state || 'agentdock-state',
  scope: scopes
 });
 return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode({clientId, clientSecret, code, redirectUri, transport = fetch}) {
 if (!clientId || !clientSecret || !code) throw Error('Client ID, Client Secret, and OAuth code are required.');
 const res = await transport('https://github.com/login/oauth/access_token', {
  method: 'POST',
  headers: {
   Accept: 'application/json',
   'Content-Type': 'application/json',
   'User-Agent': 'AgentDock-Studio'
  },
  body: JSON.stringify({
   client_id: clientId,
   client_secret: clientSecret,
   code,
   redirect_uri: redirectUri
  })
 });
 if (!res.ok) throw Error(`GitHub OAuth token exchange failed with HTTP ${res.status}`);
 const data = await res.json();
 if (data.error) throw Error(`GitHub OAuth error: ${data.error_description || data.error}`);
 return {
  accessToken: data.access_token,
  tokenType: data.token_type,
  scope: data.scope
 };
}

export async function getGitHubUser({accessToken, transport = fetch}) {
 if (!accessToken) throw Error('Access token required.');
 const res = await transport('https://api.github.com/user', {
  headers: {
   Authorization: `Bearer ${accessToken}`,
   Accept: 'application/vnd.github+json',
   'User-Agent': 'AgentDock-Studio'
  }
 });
 if (!res.ok) throw Error(`Failed to fetch GitHub user profile: HTTP ${res.status}`);
 const data = await res.json();
 return {
  login: data.login,
  id: data.id,
  name: data.name || data.login,
  avatarUrl: data.avatar_url
 };
}

export async function listUserRepositories({accessToken, transport = fetch}) {
 if (!accessToken) throw Error('Access token required.');
 const res = await transport('https://api.github.com/user/repos?per_page=100&sort=updated', {
  headers: {
   Authorization: `Bearer ${accessToken}`,
   Accept: 'application/vnd.github+json',
   'User-Agent': 'AgentDock-Studio'
  }
 });
 if (!res.ok) throw Error(`Failed to list GitHub repositories: HTTP ${res.status}`);
 const repos = await res.json();
 return repos.map(r => ({
  name: r.name,
  fullName: r.full_name,
  private: r.private,
  defaultBranch: r.default_branch,
  permissions: r.permissions || {push: false}
 }));
}

export async function verifyRepository({accessToken, repository, branch = 'main', transport = fetch}) {
 if (!accessToken) throw Error('Access token required.');
 if (!repository || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
  throw Error('Repository must be in format owner/name.');
 }

 const repoRes = await transport(`https://api.github.com/repos/${repository}`, {
  headers: {
   Authorization: `Bearer ${accessToken}`,
   Accept: 'application/vnd.github+json',
   'User-Agent': 'AgentDock-Studio'
  }
 });
 if (!repoRes.ok) throw Error(`Repository ${repository} not found or access denied (HTTP ${repoRes.status}).`);
 const repoData = await repoRes.json();

 const branchRes = await transport(`https://api.github.com/repos/${repository}/branches/${branch}`, {
  headers: {
   Authorization: `Bearer ${accessToken}`,
   Accept: 'application/vnd.github+json',
   'User-Agent': 'AgentDock-Studio'
  }
 });
 if (!branchRes.ok) throw Error(`Branch ${branch} not found in ${repository} (HTTP ${branchRes.status}).`);
 const branchData = await branchRes.json();

 return {
  verified: true,
  repository,
  branch,
  defaultBranch: repoData.default_branch,
  hasPushPermission: Boolean(repoData.permissions?.push),
  headSha: branchData.commit?.sha
 };
}

export async function pushScopedProject({accessToken, repository, branch = 'main', message, files, transport = fetch}) {
 if (!accessToken) throw Error('Access token required.');
 if (!repository || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
  throw Error('Repository must be in format owner/name.');
 }
 if (!branch || !/^[a-zA-Z0-9._/-]{1,120}$/.test(branch) || branch.includes('..')) {
  throw Error('Invalid branch name.');
 }
 if (hasSecrets(files)) {
  throw Error('Potential credential detected. Export blocked.');
 }

 async function gh(path, method = 'GET', body = null) {
  const r = await transport(`https://api.github.com${path}`, {
   method,
   headers: {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'AgentDock-Studio'
   },
   ...(body ? {body: JSON.stringify(body)} : {}),
   signal: AbortSignal.timeout(20000),
   redirect: 'error'
  });
  if (!r.ok) throw Error(`GitHub API request to ${path} failed with HTTP ${r.status}.`);
  return r.json();
 }

 const prefix = `/repos/${repository}`;
 const ref = await gh(`${prefix}/git/ref/heads/${branch}`);
 const head = ref.object.sha;
 const commit = await gh(`${prefix}/git/commits/${head}`);

 const tree = await gh(`${prefix}/git/trees`, 'POST', {
  base_tree: commit.tree.sha,
  tree: Object.entries(files).map(([p, content]) => ({
   path: p,
   mode: '100644',
   type: 'blob',
   content
  }))
 });

 const next = await gh(`${prefix}/git/commits`, 'POST', {
  message: String(message || 'Update application from AgentDock').slice(0, 200),
  tree: tree.sha,
  parents: [head]
 });

 await gh(`${prefix}/git/refs/heads/${branch}`, 'PATCH', {
  sha: next.sha,
  force: false
 });

 return {
  sha: next.sha,
  url: `https://github.com/${repository}/commit/${next.sha}`,
  branch
 };
}
