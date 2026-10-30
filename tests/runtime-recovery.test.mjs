import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRuntime} from '../lib/runtime.mjs';
import {runtimeOwner,readRuntimeRecords,processExists} from '../lib/runtime-state.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const user={id:'fixture-owner'},other={id:'fixture-other'};
const source={'index.html':'<h1>Recovery fixture</h1>','styles.css':'','app.js':'','server.mjs':'console.log("test fixture")'};
async function setup(t){
 const dataDir=await mkdtemp(path.join(root,'tmp-')),calls=[],containers=new Map(),managers=[];let failRemove=false,now=Date.now();
 const execute=async args=>{calls.push(args);const name=args.at(-1);if(args[0]==='image')return {code:0,output:args.includes('--format')?JSON.stringify({'agentdock.runtime.protocol':'3','agentdock.python.protocol':'1'}):'ready'};if(args[0]==='run'){containers.set(args[args.indexOf('--name')+1],{'agentdock.runtime':'true','agentdock.instance':runtimeOwner(dataDir)});return {code:0,output:'container'};}
  if(args[0]==='inspect')return containers.has(name)?{code:0,output:JSON.stringify(containers.get(name))}:{code:1,output:'No such object: '+name};
  if(args[0]==='rm'){if(failRemove)return {code:1,output:'Docker temporarily unavailable'};containers.delete(name);return {code:0,output:'removed'};}
  if(args[0]==='logs')return {code:0,output:'fixture logs'};throw Error('Unexpected command: '+args[0]);};
 const make=(isProcessAlive=()=>false)=>{const runtime=createRuntime({config:{dataDir,enableServers:true,runtimeLifetime:60000,sandboxImage:'fixture-image'},store:{run(){}},execute,isProcessAlive,clock:()=>now});managers.push(runtime);return runtime;};
 t.after(async()=>{failRemove=false;for(const name of containers.keys())containers.set(name,{'agentdock.runtime':'true','agentdock.instance':runtimeOwner(dataDir)});for(const m of managers)await m.close();assert.ok(path.resolve(dataDir).startsWith(root+path.sep+'tmp-'));await rm(dataDir,{recursive:true,force:true});});
 return {dataDir,calls,containers,make,setFailure:value=>failRemove=value,advance:ms=>now+=ms};
}
test('restart recovers owner controls with a new capability and no automatic source execution',async t=>{
 const f=await setup(t),before=f.make(),started=await before.start(user,{files:source,projectId:'project-1',confirm:true});const recovered=f.make();
 const rows=(await recovered.list(user)).sessions;assert.equal(rows.length,1);assert.equal(rows[0].state,'interrupted');assert.notEqual(rows[0].id,started.id);assert.equal(rows[0].projectId,'project-1');assert.equal((await recovered.list(other)).sessions.length,0);
 await assert.rejects(recovered.request(started.id,{path:'/'}),/expired/);await assert.rejects(recovered.request(rows[0].id,{path:'/'}),/interrupted/);await assert.rejects(recovered.start(user,{files:source,confirm:true}),/existing backend/);
 assert.equal(f.calls.filter(a=>a[0]==='run').length,1);assert.equal(f.calls.filter(a=>a[0]==='exec').length,0);assert.equal((await recovered.logs(user,rows[0].id)).log,'fixture logs');await recovered.stop(user,rows[0].id);assert.equal(f.containers.size,0);
});
test('failed cleanup retains its journal, blocks preview and capacity, and supports retry',async t=>{
 const f=await setup(t),runtime=f.make(),session=await runtime.start(user,{files:source,confirm:true});f.setFailure(true);
 await assert.rejects(runtime.stop(user,session.id),/retained/);assert.equal((await readRuntimeRecords(f.dataDir)).length,1);assert.equal((await runtime.list(user)).sessions[0].state,'cleanup-failed');await assert.rejects(runtime.request(session.id,{path:'/'}),/stopped/);await assert.rejects(runtime.start(user,{files:source,confirm:true}),/existing backend/);
 f.setFailure(false);await runtime.stop(user,session.id);assert.equal((await readRuntimeRecords(f.dataDir)).length,0);assert.equal(f.containers.size,0);
});
test('recovery never removes a container or reads logs with foreign ownership labels',async t=>{
 const f=await setup(t),runtime=f.make();await runtime.start(user,{files:source,confirm:true});const name=[...f.containers.keys()][0];f.containers.set(name,{'agentdock.runtime':'true','agentdock.instance':'foreign'});
 const recovered=f.make(),session=(await recovered.list(user)).sessions[0];await assert.rejects(recovered.stop(user,session.id),/ownership/);await assert.rejects(recovered.logs(user,session.id),/ownership/);assert.equal(f.calls.filter(a=>['rm','logs'].includes(a[0])).length,0);assert.equal((await readRuntimeRecords(f.dataDir)).length,1);
});
test('another live Studio process prevents takeover of its runtime records',async t=>{
 const f=await setup(t);await f.make().start(user,{files:source,confirm:true});const second=f.make(()=>true);await assert.rejects(second.list(user),/Another Studio process/);await second.close();assert.equal(f.containers.size,1);assert.equal(f.calls.filter(a=>a[0]==='rm').length,0);
});
test('a missing container can be cleaned without deleting unrelated staging files',async t=>{
 const f=await setup(t);await f.make().start(user,{files:source,confirm:true});f.containers.clear();const marker=path.join(f.dataDir,'live','keep.txt');await writeFile(marker,'unrelated');const recovered=f.make(),session=(await recovered.list(user)).sessions[0];await recovered.stop(user,session.id);assert.equal(await readFile(marker,'utf8'),'unrelated');assert.deepEqual(await readdir(path.join(f.dataDir,'live')),['keep.txt']);
});
test('malformed, oversized and path-mismatched journals are ignored without cleanup',async t=>{
 const f=await setup(t);await f.make().start(user,{files:source,confirm:true});const [record]=await readRuntimeRecords(f.dataDir),file=path.join(record.folder,'runtime.json');
 for(const contents of ['{','null','[]',JSON.stringify({...record,name:'../outside'}),JSON.stringify({...record,owner:'foreign'}),'x'.repeat(4097)]){await writeFile(file,contents);assert.equal((await readRuntimeRecords(f.dataDir)).length,0);}
 assert.equal(f.calls.filter(a=>a[0]==='rm').length,0);
});
test('expired interrupted jobs are removed after ownership verification',async t=>{
 const f=await setup(t);await f.make().start(user,{files:source,confirm:true});f.advance(61000);const recovered=f.make();assert.equal((await recovered.list(user)).sessions.length,0);assert.equal(f.containers.size,0);assert.equal((await readRuntimeRecords(f.dataDir)).length,0);assert.ok(f.calls.some(a=>a[0]==='inspect'&&a.includes('{{json .Config.Labels}}')));
});
test('a real terminated Studio subprocess leaves recoverable records without reusing its preview',async t=>{
 const f=await setup(t),moduleURL=new URL('../lib/runtime.mjs',import.meta.url).href;
 const script=`import {createRuntime} from ${JSON.stringify(moduleURL)};const config=JSON.parse(process.argv[1]);const runtime=createRuntime({config,store:{run(){}},execute:async()=>({code:0,output:JSON.stringify({'agentdock.runtime.protocol':'3','agentdock.python.protocol':'1'})})});const session=await runtime.start({id:'fixture-owner'},{files:{'index.html':'<h1>Fixture</h1>','server.mjs':'console.log(1)'},confirm:true});process.stdout.write(session.id);process.exit(0);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify({dataDir:f.dataDir,enableServers:true,runtimeLifetime:60000,sandboxImage:'fixture'})],{env:{},encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(child.status,0,child.stderr);
 const [record]=await readRuntimeRecords(f.dataDir);assert.equal(processExists(record.pid),false);f.containers.set(record.name,{'agentdock.runtime':'true','agentdock.instance':runtimeOwner(f.dataDir)});
 const recovered=f.make(processExists),session=(await recovered.list(user)).sessions[0];assert.equal(session.state,'interrupted');assert.notEqual(session.id,child.stdout);await assert.rejects(recovered.request(child.stdout,{path:'/'}),/expired/);await recovered.stop(user,session.id);assert.equal(f.containers.size,0);
});
