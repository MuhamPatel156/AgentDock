import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {validateFiles,validatePath} from '../dist/core.mjs';
import {hasSecrets} from './agents.mjs';
import {containerArgs,runDocker} from './sandbox.mjs';
import {runtimeOwner,writeRuntimeRecord,readRuntimeRecords,removeRuntimeFolder,processExists} from './runtime-state.mjs';
import {runtimeDefinition} from './runtime-definition.mjs';
export {runtimeDefinition};
export function liveContainerArgs({name,image,input,definition,lifetime,owner}){
 const args=containerArgs({name,image,input,mode:'node-test'});
 args.splice(args.indexOf('--rm'),1); // Keep bounded crash logs until Stop/expiry.
 // Keep the same resource limits, tmpfs and read-only source; replace only command.
 const index=args.indexOf('--workdir');args.splice(index,0,'--detach','--label','agentdock.runtime=true','--log-driver=local','--log-opt','max-size=1m','--log-opt','max-file=1','--log-opt','compress=false','--env','PORT='+definition.port,'--env','AGENTDOCK_ENTRY='+definition.entry,'--env','AGENTDOCK_BUILD='+(definition.build?'1':'0'),'--env','AGENTDOCK_LIFETIME_MS='+lifetime);
 if(owner){if(!/^[a-f0-9]{64}$/.test(owner))throw Error('Invalid runtime owner.');args.splice(args.indexOf('--workdir'),0,'--label','agentdock.instance='+owner);}
 args.splice(args.indexOf('--workdir'),0,'--env','AGENTDOCK_LANGUAGE='+(definition.language||'node'));
 args.splice(args.length-3,3,'node','/opt/agentdock/runtime.mjs');return args;
}
export function createRuntime({config,store,execute=runDocker,clock=Date.now,isProcessAlive=processExists}){
 const sessions=new Map(),owner=runtimeOwner(config.dataDir);let closing=false,recovery;
 const lifetime=Math.min(900000,Math.max(60000,config.runtimeLifetime||900000));
 const publicSession=s=>({id:s.id,projectId:s.projectId,sourceHash:s.sourceHash,state:s.state,created:s.created,expires:s.expires,url:'/runtime/'+s.id+'/',error:s.error||null});
 function scheduleExpiry(s){s.timer=setTimeout(()=>stop(s).catch(()=>{}),Math.max(1,s.expires-clock()));s.timer.unref?.();}
 async function recover(){
  recovery??=(async()=>{
   const records=await readRuntimeRecords(config.dataDir);
   if(records.some(row=>isProcessAlive(row.pid)))throw Error('Another Studio process owns temporary backend records. Stop that process before using this runtime.');
   if(closing)return;
   for(const row of records){const s={...row,id:randomBytes(24).toString('hex'),state:'interrupted',error:'Studio restarted. Stop this interrupted backend, then approve a fresh snapshot.',pending:0,mayExist:true,startup:Promise.resolve()};sessions.set(s.id,s);scheduleExpiry(s);}
  })();return recovery;
 }
 async function ownedContainer(s){
  if(!s.mayExist)return false;
  let result;try{result=await execute(['inspect','--format','{{json .Config.Labels}}',s.name],{timeout:6000});}catch{throw Error('Docker is unavailable. Cleanup records were retained; retry Stop when Docker is running.');}
  if(result.code!==0){if(/no such (?:object|container)\b/i.test(result.output))return false;throw Error('Docker could not confirm cleanup. Records were retained; retry Stop when Docker is running.');}
  let labels;try{labels=JSON.parse(result.output);}catch{throw Error('Cannot verify backend ownership. No container was removed.');}
  if(labels?.['agentdock.runtime']!=='true'||labels?.['agentdock.instance']!==owner)throw Error('Backend ownership does not match this Studio. No container was removed.');
  return true;
 }
 async function cleanup(s){
  clearTimeout(s.timer);
  if(await ownedContainer(s)){const result=await execute(['rm','-f',s.name],{timeout:5000});if(result.code!==0&&!/no such (?:object|container)\b/i.test(result.output))throw Error('Docker did not remove the backend. Cleanup records were retained; retry Stop.');}
  await removeRuntimeFolder(config.dataDir,s.name);
 }
 async function stop(s){
  if(s.stopping)return s.stopping;s.cancelled=true;s.state='stopping';
  s.stopping=(async()=>{await s.startup;await cleanup(s);sessions.delete(s.id);})().catch(error=>{s.state='cleanup-failed';s.error=error.message;throw error;}).finally(()=>{s.stopping=null;});return s.stopping;
 }
 async function probe(s){
  if(s.expires<=clock()){try{await stop(s);return null;}catch{return publicSession(s);}}
  if(!s.launched||s.cancelled)return publicSession(s);
  if(s.state==='starting'||s.state==='running'){
   const inspect=await execute(['inspect','--format','{{.State.Running}}',s.name],{timeout:6000});
   if(inspect.code!==0||inspect.output.trim()!=='true'){s.state='failed';s.error='Backend container stopped. Inspect its logs and restart after fixing the source.';return publicSession(s);}
   if(s.state==='starting'){try{const r=await exchange(s,{method:'GET',path:'/',headers:{},body:''});if(r.status&&!s.cancelled)s.state='running';}catch{}}
  }return publicSession(s);
 }
 async function exchange(s,input){
  if(s.pending>=4){const e=Error('Backend request queue is full.');e.status=429;throw e;}
  s.pending++;try{const r=await execute(['exec','-i',s.name,'node','/opt/agentdock/request.mjs'],{timeout:8000,input:JSON.stringify(input)});let data;try{data=JSON.parse(r.output);}catch{throw Error('Backend returned an invalid broker response.');}if(r.code!==0||data.error)throw Error(data.error||'Backend request failed.');if(!Number.isInteger(data.status)||data.status<100||data.status>599||typeof data.body!=='string'||data.body.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.body))throw Error('Invalid backend response.');return data;}finally{s.pending--;}
 }
 return {
  async start(user,input){
   if(!config.enableServers)throw Error('Live backends are disabled. Prepare the image, then set AGENTDOCK_ENABLE_SERVERS=1.');
   await recover();
   if(closing)throw Error('The Studio server is shutting down.');if(input.confirm!==true)throw Error('Approve starting this isolated backend.');
   if(sessions.size>=2||[...sessions.values()].some(s=>s.userId===user.id)){const e=Error('Stop your existing backend first. This instance supports one per account and two total.');e.status=409;throw e;}
   const files=validateFiles(input.files);if(hasSecrets(files))throw Error('Remove embedded credentials before starting a backend.');const definition=runtimeDefinition(files);if(definition.kind==='script')throw Error('Use Run Python script for a script project. Live previews require a web server.');
   const id=randomBytes(24).toString('hex'),name='agentdock-job-'+randomBytes(12).toString('hex'),folder=path.join(config.dataDir,'live',name),source=path.join(folder,'input');if(source.includes(','))throw Error('Runtime directory must not contain commas.');
   let finishStart;const startup=new Promise(resolve=>finishStart=resolve);
   const s={id,name,folder,startup,userId:user.id,sourceHash:createHash('sha256').update(JSON.stringify(files)).digest('hex'),projectId:String(input.projectId||'').slice(0,80),state:'starting',created:clock(),expires:clock()+lifetime,pending:0};sessions.set(id,s);
   try{const ready=await execute(['image','inspect',config.sandboxImage],{timeout:6000});if(ready.code!==0)throw Error('Prepare the trusted image before starting a backend.');const image=await execute(['image','inspect','--format','{{json .Config.Labels}}',config.sandboxImage],{timeout:6000});let labels;try{labels=JSON.parse(image.output);}catch{}if(image.code!==0||labels?.['agentdock.runtime.protocol']!=='3'||definition.language==='python'&&labels?.['agentdock.python.protocol']!=='1')throw Error('Rebuild the trusted image with npm run sandbox:prepare for the updated runtime, then retry.');await writeRuntimeRecord(config.dataDir,s);await mkdir(source,{recursive:true});for(const [file,text]of Object.entries(files)){const target=path.join(source,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);}
    if(closing||s.cancelled)throw Error('Backend startup was cancelled.');
    s.mayExist=true;const result=await execute(liveContainerArgs({name,image:config.sandboxImage,input:source,definition,lifetime,owner}),{timeout:10000});if(result.code!==0)throw Error('Docker could not start the backend: '+result.output.slice(0,500));
    if(closing||s.cancelled)throw Error('Backend startup was cancelled.');
    s.launched=true;scheduleExpiry(s);store.run(user.id,'backend','started',{id,entry:definition.entry,expires:s.expires});return publicSession(s);
   }catch(error){finishStart();try{await stop(s);}catch{}throw error;}finally{finishStart();}
  },
  async list(user){await recover();const own=[...sessions.values()].filter(s=>s.userId===user.id);const result=[];for(const s of own){const status=await probe(s);if(status)result.push(status);}return {enabled:Boolean(config.enableServers),sessions:result};},
  async stop(user,id){const s=sessions.get(id);if(!s||s.userId!==user.id){const e=Error('Backend unavailable.');e.status=404;throw e;}await stop(s);store.run(user.id,'backend','stopped',{id});return {ok:true};},
  async logs(user,id){const s=sessions.get(id);if(!s||s.userId!==user.id){const e=Error('Backend unavailable.');e.status=404;throw e;}if(!await ownedContainer(s))return {log:'Backend container no longer exists. Stop to clear its staging record.'};const r=await execute(['logs','--tail','100',s.name],{timeout:6000});return {log:r.output.slice(-24000)};},
  async request(id,input){const s=sessions.get(id);if(!s||s.expires<=clock()||!['starting','running'].includes(s.state)||s.cancelled){const e=Error('Backend preview expired, interrupted or stopped.');e.status=410;throw e;}if(typeof input.path!=='string'||!input.path.startsWith('/')||input.path.startsWith('//')||/[\r\n]/.test(input.path)||input.path.length>2000)throw Error('Invalid backend path.');return exchange(s,input);},
  async close(){closing=true;if(recovery)try{await recovery;}catch{}await Promise.allSettled([...sessions.values()].map(stop));}
 };
}
