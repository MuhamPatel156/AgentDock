// Intentionally excluded from *.test.mjs: these opt-in tests launch real Docker
// containers and wait for real expiry. Run npm run test:runtime-live explicitly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,lstat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createRuntime} from '../lib/runtime.mjs';
import {readRuntimeRecords} from '../lib/runtime-state.mjs';
import {diagnoseRuntime} from '../lib/runtime-diagnostics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'.agentdock','runtime-acceptance');
const user={id:'runtime-acceptance-fixture'},store={run(){}};
const files={'index.html':'<h1>Runtime acceptance fixture</h1>','server.mjs':"import http from 'node:http';console.log('Runtime acceptance listening');http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,service:'runtime-acceptance'}));}).listen(Number(process.env.PORT),'127.0.0.1');",'agentdock.runtime.json':JSON.stringify({language:'node',kind:'web',entry:'server.mjs',port:3000,build:false})};
const image=process.env.AGENTDOCK_SANDBOX_IMAGE||'agentdock-builder:local';
async function fixture(t){
 const diagnostic=await diagnoseRuntime({config:{sandboxImage:image}});
 assert.equal(diagnostic.ready,true,diagnostic.checks.filter(check=>check.status==='warn').map(check=>check.message).join(' '));
 try{assert.equal((await lstat(base)).isSymbolicLink(),false);}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(base,{recursive:true});const dataDir=await mkdtemp(path.join(base,'test-')),managers=[];
 const config={dataDir,enableServers:true,sandboxImage:image,runtimeLifetime:60000};
 const make=()=>{const runtime=createRuntime({config,store});managers.push(runtime);return runtime;};
 t.after(async()=>{
  for(const runtime of managers)await runtime.close();
  const records=await readRuntimeRecords(dataDir);
  assert.equal(records.length,0,'Cleanup failed; dedicated recovery records retained at '+dataDir);
  const target=path.resolve(dataDir);assert.equal(path.dirname(target),path.resolve(base));assert.match(path.basename(target),/^test-[a-zA-Z0-9]+$/);
  await rm(target,{recursive:true,force:true});
 });
 return {config,dataDir,make};
}
async function ready(runtime){
 const until=Date.now()+20000;
 while(Date.now()<until){const session=(await runtime.list(user)).sessions[0];if(session?.state==='running')return session;if(session?.state==='failed')throw Error((await runtime.logs(user,session.id)).log);await delay(300);}
 throw Error('Acceptance fixture did not become ready.');
}
test('real Docker backend expires, removes its container and revokes its capability',{timeout:85000},async t=>{
 const f=await fixture(t),runtime=f.make(),session=await runtime.start(user,{files,confirm:true,projectId:'expiry-fixture'});await ready(runtime);
 const response=await runtime.request(session.id,{method:'GET',path:'/api/health',headers:{},body:''});assert.equal(JSON.parse(Buffer.from(response.body,'base64')).service,'runtime-acceptance');
 assert.match((await runtime.logs(user,session.id)).log,/Runtime acceptance listening/);
 console.log('Waiting for the real 60-second expiry timer; no clock simulation is used.');
 const until=Date.now()+72000;while(Date.now()<until){if((await runtime.list(user)).sessions.length===0)break;await delay(1000);}
 assert.equal((await runtime.list(user)).sessions.length,0);assert.equal((await readRuntimeRecords(f.dataDir)).length,0);
 await assert.rejects(runtime.request(session.id,{method:'GET',path:'/',headers:{},body:''}),error=>error.status===410);
});
test('real Docker backend is recovered after an abrupt Studio subprocess exit without reusing its capability',{timeout:40000},async t=>{
 const f=await fixture(t),runtime=f.make(),moduleURL=new URL('../lib/runtime.mjs',import.meta.url).href;
 const script=`import {createRuntime} from ${JSON.stringify(moduleURL)};const runtime=createRuntime({config:JSON.parse(process.argv[1]),store:{run(){}}});const session=await runtime.start(${JSON.stringify(user)},{files:${JSON.stringify(files)},confirm:true,projectId:'recovery-fixture'});process.stdout.write(JSON.stringify(session));process.exit(0);`;
 const child=spawn(process.execPath,['--input-type=module','-e',script,JSON.stringify(f.config)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='';
 const timer=setTimeout(()=>child.kill(),25000);
 child.stdout.on('data',chunk=>{output+=chunk;if(output.length>16000)child.kill();});child.stderr.on('data',chunk=>{errors+=chunk;if(errors.length>16000)child.kill();});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);}).finally(()=>clearTimeout(timer));assert.equal(code,0,errors);
 const original=JSON.parse(output),session=(await runtime.list(user)).sessions[0];assert.equal(session.state,'interrupted');assert.notEqual(session.id,original.id);
 await assert.rejects(runtime.request(original.id,{method:'GET',path:'/',headers:{},body:''}),error=>error.status===410);
 await assert.rejects(runtime.request(session.id,{method:'GET',path:'/',headers:{},body:''}),error=>error.status===410);
 await runtime.stop(user,session.id);assert.equal((await runtime.list(user)).sessions.length,0);assert.equal((await readRuntimeRecords(f.dataDir)).length,0);
});
