import {diagnoseRuntime} from '../lib/runtime-diagnostics.mjs';
console.log('AgentDock infrastructure check. No project code or AI request is executed.');
console.log('Local .env is not loaded; use Runtime in Studio to inspect its active execution settings.');
const result=await diagnoseRuntime({config:{sandboxImage:process.env.AGENTDOCK_SANDBOX_IMAGE||'agentdock-builder:local'}});
for(const check of result.checks)console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.message}`);
process.exitCode=result.ready?0:1;
