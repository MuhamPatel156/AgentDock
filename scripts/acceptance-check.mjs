import {Store} from '../lib/store.mjs';
import {runOperationalAcceptance} from '../lib/acceptance.mjs';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

console.log('AgentDock Operational Acceptance Test Suite');
console.log('Running comprehensive infrastructure and security health checks...\n');

const dataDir = process.env.AGENTDOCK_DATA_DIR || path.join(process.cwd(), '.agentdock');
mkdirSync(dataDir, {recursive: true});
const dbPath = path.join(dataDir, 'agentdock.sqlite');
const store = new Store(dbPath);

try {
 const result = await runOperationalAcceptance(store, {
  enableBuilds: process.env.AGENTDOCK_ENABLE_BUILDS === '1'
 }, {
  dataDir,
  masterPassword: 'operational-acceptance-check'
 });

 for (const check of result.checks) {
  const badge = check.status === 'pass' ? '[PASS]' : check.status === 'warn' ? '[WARN]' : '[FAIL]';
  console.log(`${badge.padEnd(7)} ${check.name.padEnd(24)}: ${check.message}`);
 }

 console.log(`\nOverall Operational Acceptance Status: ${result.status} (${result.passedCount}/${result.totalChecks} passed, ${result.warnCount} warnings, ${result.failCount} failures)`);
 process.exitCode = result.status === 'FAIL' ? 1 : 0;
} finally {
 store.close();
}
