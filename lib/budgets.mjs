import {randomUUID} from 'node:crypto';

export const DEFAULT_BUDGET_CAPS = {
 dailyTokenCap: 100000,
 monthlyTokenCap: 2000000,
 maxConcurrentContainers: 2,
 maxStorageBytes: 52428800, // 50 MB
 alertThresholdPercent: 80
};

export function getBudgetCaps(store, userId) {
 if (userId) {
  const userCap = store.db.prepare(
   'SELECT * FROM budget_caps WHERE scope=? AND user_id=?'
  ).get('user', userId);
  if (userCap) {
   return {
    scope: 'user',
    userId,
    dailyTokenCap: userCap.daily_token_cap,
    monthlyTokenCap: userCap.monthly_token_cap,
    maxConcurrentContainers: userCap.max_concurrent_containers,
    maxStorageBytes: userCap.max_storage_bytes,
    alertThresholdPercent: userCap.alert_threshold_percent,
    updated: userCap.updated
   };
  }
 }

 const globalCap = store.db.prepare(
  'SELECT * FROM budget_caps WHERE scope=?'
 ).get('global');

 if (globalCap) {
  return {
   scope: 'global',
   userId: null,
   dailyTokenCap: globalCap.daily_token_cap,
   monthlyTokenCap: globalCap.monthly_token_cap,
   maxConcurrentContainers: globalCap.max_concurrent_containers,
   maxStorageBytes: globalCap.max_storage_bytes,
   alertThresholdPercent: globalCap.alert_threshold_percent,
   updated: globalCap.updated
  };
 }

 return {
  scope: 'default',
  userId: null,
  ...DEFAULT_BUDGET_CAPS
 };
}

export function setBudgetCaps(store, adminUserId, caps) {
 const adminUser = store.db.prepare('SELECT admin FROM users WHERE id=?').get(adminUserId);
 if (!adminUser || !adminUser.admin) {
  const err = new Error('Admin permission required to set budget caps.');
  err.status = 403;
  throw err;
 }

 const scope = caps.scope === 'global' ? 'global' : 'user';
 const targetUserId = scope === 'user' ? caps.userId : null;

 if (scope === 'user' && !targetUserId) {
  throw new Error('userId is required for user-scoped budget caps.');
 }

 const dailyTokenCap = Number.isSafeInteger(caps.dailyTokenCap) && caps.dailyTokenCap > 0 ? caps.dailyTokenCap : DEFAULT_BUDGET_CAPS.dailyTokenCap;
 const monthlyTokenCap = Number.isSafeInteger(caps.monthlyTokenCap) && caps.monthlyTokenCap > 0 ? caps.monthlyTokenCap : DEFAULT_BUDGET_CAPS.monthlyTokenCap;
 const maxConcurrentContainers = Number.isSafeInteger(caps.maxConcurrentContainers) && caps.maxConcurrentContainers > 0 ? caps.maxConcurrentContainers : DEFAULT_BUDGET_CAPS.maxConcurrentContainers;
 const maxStorageBytes = Number.isSafeInteger(caps.maxStorageBytes) && caps.maxStorageBytes > 0 ? caps.maxStorageBytes : DEFAULT_BUDGET_CAPS.maxStorageBytes;
 const alertThresholdPercent = Number.isSafeInteger(caps.alertThresholdPercent) && caps.alertThresholdPercent >= 10 && caps.alertThresholdPercent <= 100 ? caps.alertThresholdPercent : DEFAULT_BUDGET_CAPS.alertThresholdPercent;

 const id = randomUUID();
 const now = Date.now();

 store.db.prepare(`
  INSERT INTO budget_caps (id, scope, user_id, daily_token_cap, monthly_token_cap, max_concurrent_containers, max_storage_bytes, alert_threshold_percent, created, updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(scope, user_id) DO UPDATE SET
    daily_token_cap=excluded.daily_token_cap,
    monthly_token_cap=excluded.monthly_token_cap,
    max_concurrent_containers=excluded.max_concurrent_containers,
    max_storage_bytes=excluded.max_storage_bytes,
    alert_threshold_percent=excluded.alert_threshold_percent,
    updated=excluded.updated
 `).run(
  id,
  scope,
  targetUserId,
  dailyTokenCap,
  monthlyTokenCap,
  maxConcurrentContainers,
  maxStorageBytes,
  alertThresholdPercent,
  now,
  now
 );

 return getBudgetCaps(store, targetUserId);
}

export function checkBudgetStatus(store, userId, {runningContainersCount = 0} = {}) {
 if (!userId) throw new Error('userId is required to check budget status.');

 const caps = getBudgetCaps(store, userId);
 const usageRecord = store.usage(userId);

 // Calculate storage usage
 const fileStorageRow = store.db.prepare(
  'SELECT COALESCE(SUM(size), 0) as totalBytes FROM project_files WHERE user_id=?'
 ).get(userId);
 const workspaceRow = store.db.prepare(
  'SELECT length(data) as wsBytes FROM workspaces WHERE user_id=?'
 ).get(userId);

 const storageBytes = (fileStorageRow?.totalBytes || 0) + (workspaceRow?.wsBytes || 0);

 const dailyTokensUsed = usageRecord.used || 0;
 const monthlyTokensUsed = usageRecord.monthlyUsed || 0;

 const dailyTokenPercent = Math.min(100, Math.round((dailyTokensUsed / caps.dailyTokenCap) * 100));
 const monthlyTokenPercent = Math.min(100, Math.round((monthlyTokensUsed / caps.monthlyTokenCap) * 100));
 const storagePercent = Math.min(100, Math.round((storageBytes / caps.maxStorageBytes) * 100));
 const containersPercent = Math.min(100, Math.round((runningContainersCount / caps.maxConcurrentContainers) * 100));

 const exceededReasons = [];
 const warningReasons = [];

 if (dailyTokensUsed >= caps.dailyTokenCap) exceededReasons.push(`Daily token limit reached (${dailyTokensUsed}/${caps.dailyTokenCap})`);
 else if (dailyTokenPercent >= caps.alertThresholdPercent) warningReasons.push(`Daily tokens at ${dailyTokenPercent}% of limit`);

 if (monthlyTokensUsed >= caps.monthlyTokenCap) exceededReasons.push(`Monthly token limit reached (${monthlyTokensUsed}/${caps.monthlyTokenCap})`);
 else if (monthlyTokenPercent >= caps.alertThresholdPercent) warningReasons.push(`Monthly tokens at ${monthlyTokenPercent}% of limit`);

 if (storageBytes >= caps.maxStorageBytes) exceededReasons.push(`Storage cap reached (${storageBytes}/${caps.maxStorageBytes} bytes)`);
 else if (storagePercent >= caps.alertThresholdPercent) warningReasons.push(`Storage at ${storagePercent}% of cap`);

 if (runningContainersCount >= caps.maxConcurrentContainers) exceededReasons.push(`Max concurrent containers reached (${runningContainersCount}/${caps.maxConcurrentContainers})`);
 else if (containersPercent >= caps.alertThresholdPercent) warningReasons.push(`Containers at ${containersPercent}% of capacity`);

 let alert = 'ok';
 let alertMessage = 'Resource usage within budget limits.';

 if (exceededReasons.length > 0) {
  alert = 'exceeded';
  alertMessage = `Budget exceeded: ${exceededReasons.join('; ')}`;
 } else if (warningReasons.length > 0) {
  alert = 'warning';
  alertMessage = `Budget warning: ${warningReasons.join('; ')}`;
 }

 return {
  userId,
  caps,
  usage: {
   dailyTokens: dailyTokensUsed,
   monthlyTokens: monthlyTokensUsed,
   storageBytes,
   runningContainers: runningContainersCount
  },
  percentages: {
   dailyTokens: dailyTokenPercent,
   monthlyTokens: monthlyTokenPercent,
   storage: storagePercent,
   containers: containersPercent
  },
  alert,
  alertMessage
 };
}
