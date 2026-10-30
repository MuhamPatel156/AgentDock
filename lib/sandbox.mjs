import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {validateFiles,validatePath} from '../dist/core.mjs';
import {hasSecrets} from './agents.mjs';
import {sourceHash} from './verification.mjs';
import {pythonRequirements} from '../dist/environments.mjs';
import {runtimeDefinition} from './runtime-definition.mjs';
export function runDocker(args,{timeout=90000,input}={}){return new Promise((resolve,reject)=>{
 const child=spawn('docker',args,{shell:false,windowsHide:true,stdio:[input===undefined?'ignore':'pipe','pipe','pipe']});let output='',errors='',done=false;
 const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);};
 const timer=setTimeout(()=>{child.kill();finish(Error('Container operation timed out.'));},timeout);
 const bound=()=>{if(Buffer.byteLength(output)+Buffer.byteLength(errors)>2000000){child.kill();finish(Error('Container output exceeded 2 MB.'));}};child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',d=>{output+=d;bound();});child.stderr.on('data',d=>{errors+=d;bound();});
 child.on('error',()=>finish(Error('Docker CLI is unavailable. Install or start Docker Desktop yourself.')));child.on('close',code=>finish(null,{code,output:output+(errors?'\n'+errors:'')}));
 if(input!==undefined){child.stdin.on('error',()=>{});child.stdin.end(input);}
 });}
export function containerArgs({name,image,input,output,mode}){
 if(!/^agentdock-job-[a-f0-9]{24}$/.test(name))throw Error('Invalid build job name.');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,180}$/.test(image))throw Error('Invalid configured sandbox image.');
 const pythonModes={'python-syntax':'syntax','python-test':'unittest','python-pytest':'pytest','python-run':'run','python-file':'run'},pythonMode=Object.hasOwn(pythonModes,mode)?pythonModes[mode]:null;
 if(!pythonMode&&!['node-test','react-build'].includes(mode))throw Error('Unsupported sandbox job.');
 const command=pythonMode?'/opt/agentdock/venv/bin/python -I -B /opt/agentdock/python_job.py '+pythonMode+' /input /work':mode==='node-test'?'cp -R /input/. /work/ && ln -s /opt/agentdock/node_modules /work/node_modules && node --test':'cp -R /input/. /work/ && ln -s /opt/agentdock/node_modules /work/node_modules && node /opt/agentdock/node_modules/vite/bin/vite.js build --config /opt/agentdock/vite.config.mjs --configLoader native && node /opt/agentdock/export.mjs';
 return ['run','--rm','--pull=never','--name',name,'--label','agentdock.job=true','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','--memory=512m','--memory-swap=512m','--cpus=1','--pids-limit=128','--ulimit','nofile=1024:1024','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,uid=1000,gid=1000','--tmpfs','/work:rw,nosuid,nodev,size=128m,uid=1000,gid=1000','--tmpfs','/out:rw,nosuid,nodev,size=16m,uid=1000,gid=1000','--mount',`type=bind,source=${input},target=/input,readonly`,'--workdir','/work',image,'sh','-c',command];
}
export function createSandbox({config,store,execute=runDocker}){
 let active=false;
 return {
  async status(){if(!config.enableBuilds)return {enabled:false,ready:false,message:'Framework execution is disabled. Enable it only after preparing the trusted sandbox image.'};const r=await execute(['image','inspect',config.sandboxImage],{timeout:6000});return {enabled:true,ready:r.code===0,image:config.sandboxImage,message:r.code===0?'Trusted build image is available.':'Start Docker Desktop and prepare the build image. No image is pulled automatically.'};},
  async build(user,input){
   if(!config.enableBuilds)throw Error('Set AGENTDOCK_ENABLE_BUILDS=1 after preparing the Docker sandbox.');
   if(input.confirm!==true)throw Error('Confirm execution inside the isolated container.');
   if(active){const e=Error('Another build is running. This instance allows one build at a time.');e.status=409;throw e;}
   const files=validateFiles(input.files);if(hasSecrets(files))throw Error('Remove obvious credentials before building a project.');
   const mode=input.mode===undefined?'react-build':input.mode,hash=sourceHash(files);if(!['react-build','node-test','python-syntax','python-test','python-pytest','python-run','python-file'].includes(mode))throw Error('Unsupported sandbox job.');
   let entry=null;
   if(mode==='python-file'){
    entry=validatePath(input.entry);
    if(!entry.endsWith('.py')||!Object.hasOwn(files,entry))throw Error('Select an existing Python source file.');
   }else if(input.entry!==undefined)throw Error('A file selection is supported only for Run Python file.');
   if(mode.startsWith('python-')){pythonRequirements(files);if(!Object.keys(files).some(f=>f.endsWith('.py')))throw Error('Add a Python source file.');if(['python-test','python-pytest'].includes(mode)&&!Object.keys(files).some(f=>/(?:^|\/)test_[^/]+\.py$/.test(f)))throw Error('Add at least one test_*.py file.');if(mode==='python-run'){const definition=runtimeDefinition(files);if(definition.language!=='python'||definition.kind!=='script')throw Error('Run Python script requires a Python script project. Use a live backend for web servers.');}}
   if(mode==='node-test'&&!Object.keys(files).some(f=>/\.test\.(js|mjs)$/.test(f)))throw Error('Add at least one .test.js or .test.mjs file.');
   const name='agentdock-job-'+randomBytes(12).toString('hex');const folder=path.join(config.dataDir,'builds',name),source=path.join(folder,'input'),output=path.join(folder,'output');
   if(source.includes(',')||output.includes(','))throw Error('Sandbox data directory cannot contain a comma.');
   active=true;const started=Date.now();
   try{
    const ready=await execute(['image','inspect',config.sandboxImage],{timeout:6000});if(ready.code!==0)throw Error('Trusted sandbox image unavailable. Run npm run sandbox:prepare after starting Docker Desktop.');
    if(mode.startsWith('python-')){const image=await execute(['image','inspect','--format','{{json .Config.Labels}}',config.sandboxImage],{timeout:6000});let labels;try{labels=JSON.parse(image.output);}catch{}if(image.code!==0||labels?.['agentdock.python.protocol']!=='1')throw Error('Rebuild the trusted image with npm run sandbox:prepare to enable Python.');}
    await mkdir(source,{recursive:true});
    for(const [file,text]of Object.entries(files)){const target=path.join(source,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);}
    // The existing trusted runner already supports script entries. Only the job's
    // temporary copy receives this config; saved source is never changed. Keep
    // python-file distinct from full-project python-run verification evidence.
    if(entry)await writeFile(path.join(source,'agentdock.runtime.json'),JSON.stringify({language:'python',kind:'script',entry}));
    store.run(user.id,'container',mode+'-started',{job:name});
    const result=await execute(containerArgs({name,image:config.sandboxImage,input:source,output,mode}),{timeout:90000});
    // Output stays in size-limited tmpfs. No writable host path is mounted.
    let built=null;
    if(result.code===0&&mode==='react-build'){const tag='\nAGENTDOCK_OUTPUT=',marker=result.output.lastIndexOf(tag);if(marker<0)throw Error('Build produced no artifact payload.');built=validateFiles(JSON.parse(result.output.slice(marker+tag.length).split('\n')[0]),{artifact:true});}
    store.run(user.id,'container',result.code===0?'passed':'failed',{job:name,mode,entry,sourceHash:hash,exitCode:result.code});
    return {ok:result.code===0,mode,entry,sourceHash:hash,exitCode:result.code,durationMs:Date.now()-started,log:result.output.split('\nAGENTDOCK_OUTPUT=')[0].slice(0,24000),files:built};
   }catch(e){store.run(user.id,'container','failed',{job:name,mode,sourceHash:hash,message:e.message});throw e;}finally{
    // The generated name is owned by this request; never stop arbitrary containers.
    try{await execute(['rm','-f',name],{timeout:5000});}catch{}
    const base=path.resolve(config.dataDir,'builds');const target=path.resolve(folder);
    if(target.startsWith(base+path.sep+'agentdock-job-')&&/^agentdock-job-[a-f0-9]{24}$/.test(path.basename(target)))try{await rm(target,{recursive:true,force:true});}catch{}
    active=false;
   }
  }
 };
}
