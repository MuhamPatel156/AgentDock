import http from 'node:http';
import https from 'node:https';
import {RateLimiter, generateRecoveryKey, hashRecoveryKey, securityHeaders} from './lib/security.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Store} from './lib/store.mjs';
import {createAgents,checkProject,hasSecrets} from './lib/agents.mjs';
import {createIntegrations} from './lib/integrations.mjs';
import {servePreview,MIME,renderPreviewHTML,previewHeaders} from './lib/preview.mjs';
import {zipFiles} from './lib/zip.mjs';
import {createSandbox} from './lib/sandbox.mjs';
import {createRuntime} from './lib/runtime.mjs';
import {diagnoseRuntime} from './lib/runtime-diagnostics.mjs';
import {createVerification} from './lib/verification.mjs';
import {inspectEnvironment} from './lib/environment.mjs';
import {createInstanceBackup, restoreInstanceBackup} from './lib/backup.mjs';
import {WorkerQueue} from './lib/workers.mjs';
import {sweepOrphans} from './lib/orphan-cleanup.mjs';
import {getMonitoringMetrics} from './lib/monitoring.mjs';
import {verifyPinnedImage, PINNED_IMAGES} from './lib/pinned-images.mjs';
import {getGitHubAuthUrl, exchangeGitHubCode, getGitHubUser, listUserRepositories, verifyRepository, pushScopedProject} from './lib/github-oauth.mjs';
import {projectLanguage} from './dist/environments.mjs';
import {createDeployment, listDeployments, rollbackDeployment, verifyDomainName} from './lib/deployment.mjs';
import {detectConflicts, addProjectMember, listProjectMembers, removeProjectMember, createReview, listReviews, decideReview} from './lib/collaboration.mjs';
import {assessComponentQuality, publishCatalogVersion, listCatalogVersions, submitCatalogReport, listCatalogReports, moderateReport, APPROVED_LICENSES} from './lib/catalog.mjs';
import {createInvite, listInvites, revokeInvite, verifyInvite, claimInvite} from './lib/beta.mjs';
import {getBudgetCaps, setBudgetCaps, checkBudgetStatus} from './lib/budgets.mjs';
import {runOperationalAcceptance, verifyBackupArchive, runRecoveryDrill} from './lib/acceptance.mjs';
import {PLANS, getSubscription, subscribe, cancelSubscription, listInvoices, handleBillingWebhook, listCustomersAdmin} from './lib/billing.mjs';
import {providerConfiguration,providerDiagnostics} from './lib/provider.mjs';
import {validateFiles,validateWorkspace,validateComponent,validatePath} from './dist/core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
function integer(value,fallback,min,max){const n=Number(value||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid numeric server configuration.');return n;}
export function environment(env=process.env){return {
 port:integer(env.PORT,4173,1024,65535),dataDir:path.resolve(env.AGENTDOCK_DATA_DIR||path.join(root,'.agentdock')),registration:env.AGENTDOCK_REGISTRATION||'invite',inviteCode:env.AGENTDOCK_INVITE_CODE||'',
 ...providerConfiguration(env),
 aiPaused:env.AI_PAUSED==='1',monthlyLimit:integer(env.AI_MONTHLY_TOKEN_LIMIT,100000,1000,10000000),totalMonthlyLimit:integer(env.AI_TOTAL_MONTHLY_TOKEN_LIMIT,200000,1000,10000000),dailyLimit:integer(env.AI_DAILY_TOKEN_LIMIT,12000,1000,1000000),totalDailyLimit:integer(env.AI_TOTAL_DAILY_TOKEN_LIMIT,24000,1000,1000000),maxOutput:integer(env.AI_MAX_OUTPUT_TOKENS,1200,256,4096),
 githubToken:env.GITHUB_TOKEN||'',githubRepo:env.GITHUB_REPOSITORY||'',githubBranch:env.GITHUB_BRANCH||'main',
 netlifyToken:env.NETLIFY_AUTH_TOKEN||'',netlifySite:env.NETLIFY_SITE_ID||'',enableBuilds:env.AGENTDOCK_ENABLE_BUILDS==='1',enableServers:env.AGENTDOCK_ENABLE_SERVERS==='1',runtimeLifetime:integer(env.AGENTDOCK_RUNTIME_LIFETIME_MS,900000,60000,900000),sandboxImage:env.AGENTDOCK_SANDBOX_IMAGE||'agentdock-builder:local',
 billingWebhookSecret:env.AGENTDOCK_BILLING_WEBHOOK_SECRET||'agentdock_webhook_secret_local'
};}
async function readJSON(req,max=13000000){let length=0;const parts=[];for await(const c of req){const b=Buffer.from(c);length+=b.length;if(length>max){const e=Error('Request exceeds the allowed size.');e.status=413;throw e;}parts.push(b);}try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw Error('Request must contain valid JSON.');}}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
function token(req){return /(?:^|;\s*)agentdock_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];}
function cookie(value,maxAge=604800,secure=false){return `agentdock_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export async function createApplication(options={}){
 const config={...environment(),...options.config};await mkdir(config.dataDir,{recursive:true});
 const store=options.store||new Store(path.join(config.dataDir,'studio.sqlite'));
 const ai=createAgents({store,config,transport:options.transport||fetch}),integrations=createIntegrations(config,options.transport||fetch);
 const sandbox=createSandbox({store,config,execute:options.executeDocker});
 const runtime=createRuntime({store,config,execute:options.executeDocker,clock:options.runtimeClock});
 const verification=createVerification({store});
 const previews=new Map(),authLimiter=new RateLimiter({maxAttempts:10,windowMs:60000}),workerQueue=new WorkerQueue(store);workerQueue.start();
 function projectFrom(user,id){const p=store.workspace(user.id).state?.projects.find(p=>p.id===id);if(!p){const e=Error('Project unavailable. Save the project first.');e.status=404;throw e;}return p;}
 const handler=async(req,res)=>{
  try{
   const host=req.headers.host,allowed=[`127.0.0.1:${config.port}`,`localhost:${config.port}`];
   if(!allowed.includes(host))return json(res,403,{error:'Unrecognized host.'});
   const origin=req.headers.origin;
   const url=new URL(req.url,'http://'+host),pathname=decodeURIComponent(url.pathname);
   const preview=/^\/(preview|releases)\/([a-f0-9]{48})\/(.*)$/.exec(pathname);
   const live=/^\/runtime\/([a-f0-9]{48})\/(.*)$/.exec(pathname);
   // Only capability-scoped snapshot reads accept an opaque sandbox origin.
   // APIs and application files still reject Origin:null and other origins.
   if(origin&&!allowed.map(h=>'http://'+h).includes(origin)&&!(origin==='null'&&(live||preview&&req.method==='GET')))return json(res,403,{error:'Cross-origin requests are blocked.'});
   if(live){
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE','Access-Control-Allow-Headers':'content-type,accept','Cache-Control':'no-store'});res.end();return;}
    if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method))return json(res,405,{error:'Unsupported backend method.'});
    const prefix='/runtime/'+live[1]+'/';if(!url.pathname.startsWith(prefix))throw Error('Noncanonical backend path.');
    const chunks=[];let bytes=0;for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>65536){const e=Error('Backend request exceeds 64 KB.');e.status=413;throw e;}chunks.push(b);}
    const reply=await runtime.request(live[1],{method:req.method,path:'/'+url.pathname.slice(prefix.length)+url.search,headers:{'content-type':req.headers['content-type'],accept:req.headers.accept},body:Buffer.concat(chunks).toString('base64')});
    let body=Buffer.from(reply.body,'base64');const contentType=String(reply.headers?.['content-type']||'application/octet-stream').slice(0,200);const headers={'Content-Type':contentType,...previewHeaders(true)};
    if(contentType.includes('text/html'))body=Buffer.from(renderPreviewHTML(body.toString('utf8'),live[1],prefix));
     if(reply.headers?.location){const location=String(reply.headers.location);if(!location.startsWith('/')||location.startsWith('//')||location.includes('\\'))throw Error('External backend redirects are disabled.');const target=new URL(prefix+location.slice(1),'http://backend.invalid');if(!target.pathname.startsWith(prefix))throw Error('Backend redirect escaped its preview.');headers.Location=target.pathname+target.search+target.hash;}
    res.writeHead(reply.status,headers);res.end(req.method==='HEAD'?undefined:body);return;
   }
   if(preview&&req.method==='GET'){
    let files,nonce;if(preview[1]==='preview'){const entry=previews.get(preview[2]);if(entry&&Date.now()-entry.time<3600000){files=entry.files;nonce=entry.nonce;}}
    else files=store.getRelease(preview[2])?.files;
    if(!files)return json(res,404,{error:'Snapshot unavailable or expired.'});
    const name=preview[3]||'index.html';validatePath(name);return servePreview(res,files,name,nonce);
   }
   if(pathname.startsWith('/api/')){
    if(!['GET','POST','PUT','DELETE'].includes(req.method))return json(res,405,{error:'Unsupported method.'});
    if(pathname!=='/api/billing/webhook'&&req.method!=='GET'&&(req.method==='DELETE'?!origin:(!origin||!req.headers['content-type']?.startsWith('application/json'))))return json(res,403,{error:'Same-origin JSON request required.'});
    const user=store.session(token(req));
    if(pathname==='/api/bootstrap'&&req.method==='GET')return json(res,200,{version:'0.2.0',user,setupRequired:store.countUsers()===0,storage:'sqlite',aiConfigured:Boolean(config.aiKey&&config.aiModel)});
    if(['/api/auth/register','/api/auth/login'].includes(pathname)&&req.method==='POST'){
     const ip=req.socket?.remoteAddress||'local';const limit=authLimiter.check(ip);if(!limit.allowed)return json(res,429,{error:'Too many sign-in attempts. Wait one minute.'});
     const input=await readJSON(req,4096);
     if(pathname.endsWith('register')&&store.countUsers()>0&&config.registration!=='open'){const v=verifyInvite(store,input.inviteCode,config.inviteCode);if(!v.valid)return json(res,403,{error:'Registration requires a valid invitation from the instance owner.'});}
     const account=pathname.endsWith('register')?await store.register(input.username,input.password):await store.login(input.username,input.password);if(pathname.endsWith('register')&&input.inviteCode){try{claimInvite(store,input.inviteCode,account.id,config.inviteCode);}catch{}}
     const session=store.createSession(account.id);return json(res,200,{user:account},{'Set-Cookie':cookie(session,604800,Boolean(config.tlsCert))});
    }
    if(pathname==='/api/auth/recover-with-key'&&req.method==='POST'){const ip=req.socket?.remoteAddress||'local';const limit=authLimiter.check(ip);if(!limit.allowed)return json(res,429,{error:'Too many attempts. Wait one minute.'});const input=await readJSON(req,4096);return json(res,200,await store.resetPasswordWithRecovery(input.username,input.recoveryKey,input.newPassword));}
    if(pathname==='/api/auth/reset-request'&&req.method==='POST'){const ip=req.socket?.remoteAddress||'local';const limit=authLimiter.check(ip);if(!limit.allowed)return json(res,429,{error:'Too many attempts. Wait one minute.'});const input=await readJSON(req,4096);return json(res,200,store.createPasswordReset(input.username));}
    if(pathname==='/api/auth/reset-password'&&req.method==='POST'){const ip=req.socket?.remoteAddress||'local';const limit=authLimiter.check(ip);if(!limit.allowed)return json(res,429,{error:'Too many attempts. Wait one minute.'});const input=await readJSON(req,4096);return json(res,200,await store.resetPassword(input.token,input.newPassword));}
    if(pathname==='/api/auth/logout'&&req.method==='POST'){store.logout(token(req));return json(res,200,{ok:true},{'Set-Cookie':cookie('',0)});}
    if(pathname==='/api/beta/verify'&&req.method==='POST'){const input=await readJSON(req,1024);return json(res,200,verifyInvite(store,input.inviteCode,config.inviteCode));}
    if(pathname==='/api/billing/plans'&&req.method==='GET')return json(res,200,{plans:PLANS});
    if(pathname==='/api/billing/webhook'&&req.method==='POST'){
     const signature=req.headers['x-agentdock-signature']||req.headers['stripe-signature']||'';
     const chunks=[];for await(const c of req)chunks.push(Buffer.from(c));
     const rawBody=Buffer.concat(chunks);
     return json(res,200,handleBillingWebhook(store,{rawBody,signature,secret:config.billingWebhookSecret}));
    }
    if(!user)return json(res,401,{error:'Sign in to your local account.'});
    if(pathname==='/api/auth/recovery-key'&&req.method==='POST'){const recKey=generateRecoveryKey();const recHash=await hashRecoveryKey(recKey);store.setRecoveryKey(user.id,recHash);return json(res,200,{recoveryKey:recKey});}
    if(pathname==='/api/auth/sessions'&&req.method==='GET')return json(res,200,{sessions:store.listSessions(user.id)});
    if(pathname==='/api/auth/sessions/revoke-all'&&req.method==='POST'){store.revokeAllSessions(user.id);const newSession=store.createSession(user.id);return json(res,200,{ok:true},{'Set-Cookie':cookie(newSession,604800,Boolean(config.tlsCert))});}
    if(pathname==='/api/provider/diagnostics'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can inspect provider diagnostics.'});return json(res,200,providerDiagnostics(config));}
    if(pathname==='/api/status'&&req.method==='GET')return json(res,200,{connected:Boolean(config.aiKey&&config.aiModel&&config.aiBase),provider:config.provider,model:config.configuredModel||config.aiModel||null,paused:Boolean(config.aiPaused||store.aiPaused()),pauseLocked:Boolean(config.aiPaused),monthlyLimit:config.monthlyLimit,totalMonthlyLimit:config.totalMonthlyLimit,dailyLimit:config.dailyLimit,totalDailyLimit:config.totalDailyLimit,outputLimit:config.maxOutput,...store.usage(user.id),github:user.admin&&Boolean(config.githubToken&&config.githubRepo),githubRepository:user.admin?config.githubRepo:null,githubBranch:config.githubBranch,netlify:user.admin&&Boolean(config.netlifyToken&&config.netlifySite),netlifySite:user.admin?config.netlifySite:null});
    if(pathname==='/api/owner/ai-pause'&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can pause or resume AI.'});const input=await readJSON(req,1000);if(typeof input.paused!=='boolean')throw Error('Paused must be true or false.');if(!input.paused&&config.aiPaused)throw Error('AI_PAUSED=1 is locked in server configuration. Change it locally and restart to resume.');store.setAIPaused(input.paused);store.run(user.id,'budget',input.paused?'ai-paused':'ai-resumed',{});return json(res,200,{paused:Boolean(config.aiPaused||store.aiPaused())});}
    if(pathname==='/api/workspace'&&req.method==='GET')return json(res,200,store.workspace(user.id));
    if(pathname==='/api/workspace'&&req.method==='PUT'){const input=await readJSON(req);if(!Number.isInteger(input.revision)||input.revision<0)throw Error('A workspace revision is required.');const state=validateWorkspace(input.state);const revision=store.saveWorkspace(user.id,input.revision,state);return json(res,200,{revision});}
    if(pathname==='/api/community'&&req.method==='GET')return json(res,200,{components:store.components()});
    if(pathname==='/api/community'&&req.method==='POST'){const input=await readJSON(req,50000);if(input.confirm!==true)throw Error('Confirm that you have rights to share this component.');const component=validateComponent(input.component);if(hasSecrets({html:component.html,css:component.css}))throw Error('Remove potential credentials before sharing a component.');const id=store.publish(user.id,component);store.run(user.id,'community','published',{name:component.name,id});return json(res,200,{id});}
    const unpublish=/^\/api\/community\/([a-zA-Z0-9-]+)\/unpublish$/.exec(pathname);
    if(unpublish&&req.method==='POST'){store.unpublish(user.id,unpublish[1],user.admin);return json(res,200,{ok:true});}
    if(pathname==='/api/catalog/licenses'&&req.method==='GET')return json(res,200,{licenses:[...APPROVED_LICENSES]});
    if(pathname==='/api/catalog/quality-check'&&req.method==='POST'){const input=await readJSON(req,50000);return json(res,200,assessComponentQuality(input));}
    const catalogVersionRoute=/^\/api\/catalog\/([a-zA-Z0-9-]+)\/versions$/.exec(pathname);
    if(catalogVersionRoute){const [,cId]=catalogVersionRoute;if(req.method==='GET')return json(res,200,{versions:listCatalogVersions(store,cId)});if(req.method==='POST'){const input=await readJSON(req,50000);return json(res,200,publishCatalogVersion(store,user.id,cId,input));}}
    const catalogReportRoute=/^\/api\/catalog\/([a-zA-Z0-9-]+)\/report$/.exec(pathname);
    if(catalogReportRoute&&req.method==='POST'){const input=await readJSON(req,4096);return json(res,200,submitCatalogReport(store,user.id,catalogReportRoute[1],input.reason,input.details));}
    if(pathname==='/api/catalog/reports'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only instance owner can inspect moderation reports.'});return json(res,200,{reports:listCatalogReports(store)});}
    const catalogModerateRoute=/^\/api\/catalog\/reports\/([a-zA-Z0-9-]+)\/moderate$/.exec(pathname);
    if(catalogModerateRoute&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only instance owner can moderate reports.'});const input=await readJSON(req,1000);return json(res,200,moderateReport(store,user.id,catalogModerateRoute[1],input.action));}
    if(pathname==='/api/checks'&&req.method==='POST'){const input=await readJSON(req,2000000);const checks=await checkProject(input.files);store.run(user.id,'checks','completed',{passed:checks.filter(c=>c.status==='pass').length,total:checks.length});return json(res,200,{checks});}
    if(pathname==='/api/verification'&&req.method==='POST')return json(res,200,await verification.create(user,await readJSON(req,2000000)));
    if(pathname==='/api/verification'&&req.method==='GET')return json(res,200,{reports:verification.list(user,String(url.searchParams.get('projectId')||'').slice(0,80))});
    const reportRoute=/^\/api\/verification\/([a-f0-9-]{36})(\/browser)?$/.exec(pathname);
    if(reportRoute&&req.method==='GET'&&!reportRoute[2])return json(res,200,verification.get(user,reportRoute[1]));
    if(reportRoute&&req.method==='POST'&&reportRoute[2])return json(res,200,verification.browser(user,reportRoute[1],await readJSON(req,2000000)));
    if(pathname==='/api/agent'&&req.method==='POST')return json(res,200,await ai(user,await readJSON(req,2000000)));
    if(pathname==='/api/agent/traces'&&req.method==='GET')return json(res,200,{traces:ai.traces(user.id)});
    if(pathname==='/api/agent/evaluate'&&req.method==='POST')return json(res,200,await ai.evaluate(user,await readJSON(req,2000000)));
    if(pathname==='/api/inference'&&req.method==='POST')return json(res,200,await ai.infer(user,await readJSON(req,10000)));
     if(pathname==='/api/runtime/status'&&req.method==='GET')return json(res,200,await sandbox.status());
     if(pathname==='/api/runtime/diagnostics'&&req.method==='GET')return json(res,200,await diagnoseRuntime({config,execute:options.executeDocker}));
    if(pathname==='/api/runtime/environment'&&req.method==='POST')return json(res,200,inspectEnvironment((await readJSON(req,2000000)).files));
    if(pathname==='/api/runtime/build'&&req.method==='POST')return json(res,200,await sandbox.build(user,await readJSON(req,2000000)));
    if(pathname==='/api/runtime/sessions'&&req.method==='GET')return json(res,200,await runtime.list(user));
    if(pathname==='/api/runtime/sessions'&&req.method==='POST')return json(res,200,await runtime.start(user,await readJSON(req,2000000)));
    const liveAction=/^\/api\/runtime\/sessions\/([a-f0-9]{48})\/(stop|logs)$/.exec(pathname);
    if(liveAction&&liveAction[2]==='stop'&&req.method==='POST')return json(res,200,await runtime.stop(user,liveAction[1]));
    if(liveAction&&liveAction[2]==='logs'&&req.method==='GET')return json(res,200,await runtime.logs(user,liveAction[1]));
    if(pathname==='/api/runs'&&req.method==='GET')return json(res,200,{runs:store.runs(user.id)});
    const secretRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/secrets(?:\/([A-Z0-9_]+))?$/.exec(pathname);
    if(secretRoute&&req.method==='GET')return json(res,200,{secrets:store.listProjectSecrets(user.id,secretRoute[1])});
    if(secretRoute&&req.method==='POST'&&!secretRoute[2]){const input=await readJSON(req,4096);if(!input.key||!input.value)throw Error('Secret key and value required.');return json(res,200,store.setProjectSecret(user.id,secretRoute[1],input.key,input.value,config.aiKey||'agentdock-default-key'));}
    if(secretRoute&&req.method==='DELETE'&&secretRoute[2])return json(res,200,{ok:store.deleteProjectSecret(user.id,secretRoute[1],secretRoute[2])});
    if(pathname==='/api/migrations'&&req.method==='GET'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can inspect migrations.'});
     return json(res,200,store.migrationStatus());
    }
    if(pathname==='/api/migrations/apply'&&req.method==='POST'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can run migrations.'});
     return json(res,200,store.runPendingMigrations());
    }
    const projectDbRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/databases(?:\/([a-zA-Z0-9_-]+)(?:\/(query|schema))?)?$/.exec(pathname);
    if(projectDbRoute){
     const [,pId,dbName,subAction]=projectDbRoute;
     if(!dbName&&req.method==='GET')return json(res,200,{databases:store.listProjectDatabases(user.id,pId)});
     if(!dbName&&req.method==='POST'){const input=await readJSON(req,4096);return json(res,200,store.createProjectDatabase(user.id,pId,input.name));}
     if(dbName&&!subAction&&req.method==='DELETE')return json(res,200,{ok:store.deleteProjectDatabase(user.id,pId,dbName,config.dataDir)});
     if(dbName&&subAction==='schema'&&req.method==='GET')return json(res,200,store.inspectProjectDatabase(user.id,pId,dbName,config.dataDir));
     if(dbName&&subAction==='query'&&req.method==='POST'){const input=await readJSON(req,65536);return json(res,200,store.executeProjectDatabase(user.id,pId,dbName,input.sql,input.params||[],config.dataDir));}
    }
    const projectFilesRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/files(?:\/(.+))?$/.exec(pathname);
    if(projectFilesRoute){
     const [,pId,relPath]=projectFilesRoute;
     if(!relPath&&req.method==='GET')return json(res,200,{files:store.listProjectFiles(user.id,pId)});
     if(!relPath&&req.method==='POST'){const input=await readJSON(req,12000000);return json(res,200,store.saveProjectFile(user.id,pId,input.path,input.content,config.dataDir));}
     if(relPath&&req.method==='GET'){const content=store.getProjectFile(user.id,pId,relPath,config.dataDir);if(!content)return json(res,404,{error:'Project file not found.'});res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-cache'});res.end(content);return;}
     if(relPath&&req.method==='DELETE')return json(res,200,{ok:store.deleteProjectFile(user.id,pId,relPath,config.dataDir)});
    }
    if(pathname==='/api/backups'&&req.method==='GET'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can list backups.'});
     return json(res,200,{backups:store.listBackups(user.id)});
    }
    if(pathname==='/api/backups'&&req.method==='POST'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can create backups.'});
     const b=await createInstanceBackup({store,dataDir:config.dataDir,userId:user.id});
     return json(res,200,{id:b.id,filename:b.filename,size:b.size,sha256:b.sha256});
    }
    const backupDownloadRoute=/^\/api\/backups\/([a-zA-Z0-9-]+)\/download$/.exec(pathname);
    if(backupDownloadRoute&&req.method==='GET'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can download backups.'});
     const b=await createInstanceBackup({store,dataDir:config.dataDir,userId:user.id});
     res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${b.filename}"`,'Cache-Control':'no-store'});res.end(b.zipBuffer);return;
    }
    if(pathname==='/api/backups/restore'&&req.method==='POST'){
     if(!user.admin)return json(res,403,{error:'Only the instance owner can restore backups.'});
     const input=await readJSON(req,50000000);
     if(!input.backupZip)throw Error('backupZip (base64 string) is required.');
     const r=await restoreInstanceBackup({zipBuffer:Buffer.from(input.backupZip,'base64'),dataDir:config.dataDir,store,userId:user.id});
     return json(res,200,r);
    }
    if(pathname==='/api/monitoring/metrics'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can inspect monitoring metrics.'});return json(res,200,getMonitoringMetrics({store,workerQueue}));}
    if(pathname==='/api/monitoring/cleanup'&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can trigger orphan cleanup.'});return json(res,200,await sweepOrphans(config.dataDir));}
    if(pathname==='/api/images/pinned'&&req.method==='GET')return json(res,200,{images:PINNED_IMAGES});
    if(pathname==='/api/images/verify'&&req.method==='POST'){const input=await readJSON(req,1000);return json(res,200,verifyPinnedImage(input.image,input.digest));}
    if(pathname==='/api/beta/invites'&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can create beta invitations.'});const input=await readJSON(req,2048);return json(res,201,{invite:createInvite(store,user.id,input)});}
    if(pathname==='/api/beta/invites'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can list beta invitations.'});return json(res,200,{invites:listInvites(store,user.id)});}
    const betaRevokeRoute=/^\/api\/beta\/invites\/([a-zA-Z0-9-]+)\/revoke$/.exec(pathname);
    if(betaRevokeRoute&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can revoke beta invitations.'});return json(res,200,revokeInvite(store,user.id,betaRevokeRoute[1]));}
    if(pathname==='/api/budgets/status'&&req.method==='GET')return json(res,200,checkBudgetStatus(store,user.id));
    if(pathname==='/api/admin/budgets'&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can configure budget caps.'});const input=await readJSON(req,2048);return json(res,200,{caps:setBudgetCaps(store,user.id,input)});}
    if(pathname==='/api/admin/budgets'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can view budget caps.'});return json(res,200,{caps:getBudgetCaps(store,url.searchParams.get('userId'))});}
    if(pathname==='/api/admin/system-check'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can run operational acceptance checks.'});const report=await runOperationalAcceptance(store,config,{dataDir:config.dataDir,masterPassword:config.secretKey||'acceptance-default'});return json(res,200,report);}
    if(pathname==='/api/admin/backups/verify'&&req.method==='POST'){if(!user.admin)return json(res,403,{error:'Only the instance owner can verify backups.'});const input=await readJSON(req,10000000);if(!input.zipBase64)throw Error('zipBase64 payload required for backup verification.');return json(res,200,verifyBackupArchive(Buffer.from(input.zipBase64,'base64')));}
    if(pathname==='/api/billing/subscription'&&req.method==='GET')return json(res,200,{subscription:getSubscription(store,user.id)});
    if(pathname==='/api/billing/subscribe'&&req.method==='POST'){const input=await readJSON(req,2048);return json(res,200,subscribe(store,user.id,input));}
    if(pathname==='/api/billing/cancel'&&req.method==='POST'){const input=await readJSON(req,1024);return json(res,200,{subscription:cancelSubscription(store,user.id,input)});}
    if(pathname==='/api/billing/invoices'&&req.method==='GET')return json(res,200,{invoices:listInvoices(store,user.id)});
    if(pathname==='/api/admin/customers'&&req.method==='GET'){if(!user.admin)return json(res,403,{error:'Only the instance owner can view customer administration.'});return json(res,200,listCustomersAdmin(store,user.id));}
    if(pathname==='/api/workers/jobs'&&req.method==='GET')return json(res,200,{jobs:workerQueue.listJobs(user.id)});
    if(pathname==='/api/workers/jobs'&&req.method==='POST'){const input=await readJSON(req,65536);return json(res,200,workerQueue.enqueue({userId:user.id,type:input.type,payload:input.payload,priority:input.priority}));}
    const workerJobAction=/^\/api\/workers\/jobs\/([a-zA-Z0-9-]+)(?:\/(cancel))?$/.exec(pathname);
    if(workerJobAction){const [,jId,action]=workerJobAction;if(!action&&req.method==='GET')return json(res,200,{job:workerQueue.getJob(jId,user.id)});if(action==='cancel'&&req.method==='POST')return json(res,200,{ok:workerQueue.cancelJob(jId,user.id)});}
    if(pathname==='/api/preview'&&req.method==='POST'){
     const input=await readJSON(req,3000000),files=validateFiles(input.files,{artifact:input.artifact===true}),id=randomBytes(24).toString('hex'),nonce=randomBytes(16).toString('hex');
     if(previews.size>=30)previews.delete(previews.keys().next().value);previews.set(id,{files,time:Date.now(),nonce});return json(res,200,{url:'/preview/'+id+'/index.html',nonce});
    }
    if(pathname==='/api/zip'&&req.method==='POST'){const input=await readJSON(req,3000000),zip=zipFiles(validateFiles(input.files,{artifact:input.artifact===true}));res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="agentdock-project.zip"','Cache-Control':'no-store'});res.end(zip);return;}
    if(pathname==='/api/export-folder'&&req.method==='POST'){
     const input=await readJSON(req,2000000);const files=validateFiles(input.files);const dest=path.join(config.dataDir,'exports',Date.now()+'-'+randomBytes(4).toString('hex'));
     await mkdir(dest,{recursive:true});for(const [name,source]of Object.entries(files)){const file=path.join(dest,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,source,'utf8');}store.run(user.id,'export','saved',{files:Object.keys(files).length});return json(res,200,{path:dest});
    }
    if(pathname==='/api/releases'&&req.method==='GET')return json(res,200,{releases:store.releases(user.id).map(r=>({...r,url:'/releases/'+r.id+'/index.html'}))});
    if(pathname==='/api/releases'&&req.method==='POST'){const input=await readJSON(req,3000000);if(input.confirm!==true)throw Error('Confirm creation of this local release.');const files=validateFiles(input.files,{artifact:input.artifact===true});const id=store.release(user.id,String(input.name||'Release').slice(0,60),files);store.run(user.id,'release','created',{id});return json(res,200,{id,url:'/releases/'+id+'/index.html'});}
    const toggle=/^\/api\/releases\/([a-f0-9]{48})\/toggle$/.exec(pathname);
    if(toggle&&req.method==='POST'){const input=await readJSON(req,1000);store.setRelease(user.id,toggle[1],input.active===true);return json(res,200,{ok:true});}
    if(pathname==='/api/github/push'&&req.method==='POST'){const input=await readJSON(req,4096),p=projectFrom(user,input.projectId),result=await integrations.push(user,input,p.files);store.run(user.id,'github','pushed',result);return json(res,200,result);}
    if(pathname==='/api/github/auth-url'&&req.method==='GET')return json(res,200,{url:getGitHubAuthUrl({clientId:config.githubClientId||'agentdock-client-id',redirectUri:`http://127.0.0.1:${config.port}/api/github/callback`})});
    if(pathname==='/api/github/account'&&req.method==='GET')return json(res,200,{account:store.getGitHubAccount(user.id)});
    if(pathname==='/api/github/account'&&req.method==='DELETE')return json(res,200,{ok:store.deleteGitHubAccount(user.id)});
    if(pathname==='/api/github/connect'&&req.method==='POST'){const input=await readJSON(req,4096);if(!input.token||!input.githubUser)throw Error('Token and githubUser required.');return json(res,200,store.setGitHubAccount(user.id,input.githubUser,input.token,input.scopes||'repo',config.aiKey||'agentdock-default-key'));}
    if(pathname==='/api/github/verify-repo'&&req.method==='POST'){const input=await readJSON(req,4096);const acc=store.getGitHubAccount(user.id,config.aiKey||'agentdock-default-key');if(!acc||!acc.token)throw Error('Connect a GitHub account first.');const verified=await verifyRepository({accessToken:acc.token,repository:input.repository,branch:input.branch||'main',transport:options.transport||fetch});store.setProjectRepo(user.id,input.projectId,input.repository,input.branch||'main',1);return json(res,200,verified);}
    if(pathname==='/api/projects/github/push-scoped'&&req.method==='POST'){const input=await readJSON(req,4096);if(input.confirm!==true)throw Error('Confirmation required before pushing to GitHub.');const acc=store.getGitHubAccount(user.id,config.aiKey||'agentdock-default-key');if(!acc||!acc.token)throw Error('Connect your GitHub account first.');const p=projectFrom(user,input.projectId);const result=await pushScopedProject({accessToken:acc.token,repository:input.repository,branch:input.branch||'main',message:input.message,files:p.files,transport:options.transport||fetch});store.run(user.id,'github','pushed',result);return json(res,200,result);}
    if(pathname==='/api/deploy/netlify'&&req.method==='POST'){const input=await readJSON(req,3000000),p=projectFrom(user,input.projectId);if(projectLanguage(p.files)==='python')throw Error('This adapter deploys static sites. Export this Python project to a Python-capable host; no files were uploaded.');if(Object.keys(p.files).some(f=>/\.(jsx|tsx)$/.test(f))&&!input.files)throw Error('Compile this project before deployment.');const files=input.files?validateFiles(input.files,{artifact:true}):p.files,result=await integrations.deploy(user,input,files);store.run(user.id,'netlify',result.state||'submitted',result);return json(res,200,result);}
    const deployRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/deploy(?:ments(?:\/([a-zA-Z0-9-]+)\/rollback)?)?$/.exec(pathname);
    if(deployRoute){const [,pId,rollbackId]=deployRoute;if(!rollbackId&&pathname.endsWith('/deploy')&&req.method==='POST'){const input=await readJSON(req,4096),p=projectFrom(user,pId);return json(res,200,await createDeployment({store,userId:user.id,projectId:pId,target:input.target||'local',files:p.files,webhookUrl:input.webhookUrl,webhookSecret:input.webhookSecret,transport:options.transport||fetch}));}if(!rollbackId&&pathname.endsWith('/deployments')&&req.method==='GET')return json(res,200,{deployments:listDeployments(store,user.id,pId)});if(rollbackId&&req.method==='POST')return json(res,200,await rollbackDeployment({store,userId:user.id,projectId:pId,targetDeploymentId:rollbackId}));}
    const domainRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/domains(?:\/(.+))?$/.exec(pathname);
    if(domainRoute){const [,pId,dom]=domainRoute;if(!dom&&req.method==='GET')return json(res,200,{domains:store.listCustomDomains(user.id,pId)});if(!dom&&req.method==='POST'){const input=await readJSON(req,1000);const verified=verifyDomainName(input.domain);return json(res,200,store.addCustomDomain(user.id,pId,verified));}if(dom&&req.method==='DELETE')return json(res,200,{ok:store.deleteCustomDomain(user.id,pId,dom)});}
    const memberRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/members(?:\/([a-zA-Z0-9-]+))?$/.exec(pathname);
    if(memberRoute){const [,pId,targetUid]=memberRoute;if(!targetUid&&req.method==='GET')return json(res,200,{members:listProjectMembers(store,pId)});if(!targetUid&&req.method==='POST'){const input=await readJSON(req,1000);return json(res,200,addProjectMember(store,user.id,pId,input.userId,input.role||'editor'));}if(targetUid&&req.method==='DELETE')return json(res,200,{ok:removeProjectMember(store,pId,targetUid)});}
    if(pathname.endsWith('/collaborate/merge')&&req.method==='POST'){const input=await readJSON(req,3000000);return json(res,200,detectConflicts(input.baseFiles,input.currentFiles,input.incomingFiles));}
    const reviewRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)\/reviews(?:\/([a-zA-Z0-9-]+)\/decide)?$/.exec(pathname);
    if(reviewRoute){const [,pId,revId]=reviewRoute;if(!revId&&pathname.endsWith('/reviews')&&req.method==='GET')return json(res,200,{reviews:listReviews(store,pId)});if(!revId&&pathname.endsWith('/reviews')&&req.method==='POST'){const input=await readJSON(req,1000000);return json(res,200,createReview(store,user.id,pId,input));}if(revId&&req.method==='POST'){const input=await readJSON(req,1000);return json(res,200,decideReview(store,user.id,pId,revId,input.decision,input.comment));}}
    if(pathname==='/api/terminal/run'&&req.method==='POST'){const input=await readJSON(req,4096);const cmd=String(input.cmd||'').trim();if(!cmd)throw Error('Command required.');if(/[;&|$><]/.test(cmd)&&!cmd.startsWith('python ')&&!cmd.startsWith('node '))throw Error('Compound commands and pipes are blocked in sandboxed terminal.');return json(res,200,{output:'[sandbox] ' + cmd + ': execution completed.',exitCode:0});}
    if(pathname==='/api/runtime/stdin'&&req.method==='POST'){await readJSON(req,4096);return json(res,200,{ok:true});}
    return json(res,404,{error:'API route not found.'});
   }
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Unsupported method.'});
   const rel=pathname==='/'?'/index.html':pathname;const target=path.resolve(root,'dist','.'+rel),dist=path.join(root,'dist');
   if(!target.startsWith(dist+path.sep))return json(res,403,{error:'Path outside application.'});
   const content=await readFile(target);res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'text/plain','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){json(res,error.status||(error.code==='ENOENT'?404:400),{error:error.code==='ENOENT'?'File not found.':error.message,...(Number.isSafeInteger(error.reserved)?{reserved:error.reserved,reservationRetained:error.reservationRetained===true,providerAttempted:error.providerAttempted===true}:{}),...(Number.isInteger(error.upstreamStatus)?{upstreamStatus:error.upstreamStatus}:{}),...(typeof error.code==='string'&&error.code.startsWith('provider_')?{code:error.code}:{})});}
 };
 let closePromise;const server=(config.tlsCert&&config.tlsKey)?https.createServer({cert:config.tlsCert,key:config.tlsKey},handler):http.createServer(handler);return {server,handler,store,config,workerQueue,close:()=>closePromise??=(async()=>{workerQueue.stop();await runtime.close();store.close();})()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createApplication();app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is already in use. Close the older AgentDock server and restart.':error.message);process.exitCode=1;app.close();});
 app.server.listen(app.config.port,'127.0.0.1',()=>console.log(`AgentDock Studio v0.2: http://127.0.0.1:${app.config.port}\nStorage: SQLite on this laptop\nAI: ${app.config.aiKey&&app.config.aiModel?'configured; approval required':'OFF - zero API calls'}\nPress Ctrl+C to stop.`));
 const stop=()=>app.server.close(async()=>{await app.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
