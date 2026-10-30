import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import net from 'node:net';
import {pythonTemplate,reactPythonTemplate} from '../dist/python-templates.mjs';
import {PYTHON_PACKAGES,pythonRequirements,projectLanguage} from '../dist/environments.mjs';
import {validateFiles,validatePath} from '../dist/core.mjs';
import {runtimeDefinition,liveContainerArgs} from '../lib/runtime.mjs';
import {containerArgs} from '../lib/sandbox.mjs';
import {fixture} from './helpers.mjs';
import {workspace} from './helpers.mjs';
const testRoot=path.dirname(fileURLToPath(import.meta.url)),job=fileURLToPath(new URL('../sandbox/python_job.py',import.meta.url));
const cleanEnv=()=>Object.fromEntries(Object.entries({PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1'}).filter(([,value])=>value!==undefined));
async function sourceFolder(t,files){const root=await mkdtemp(path.join(testRoot,'tmp-')),source=path.join(root,'source'),work=path.join(root,'work');await mkdir(source);for(const [name,text]of Object.entries(files)){const target=path.join(source,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);}t.after(async()=>{assert.ok(path.resolve(root).startsWith(testRoot+path.sep+'tmp-'));await rm(root,{recursive:true,force:true});});return {root,source,work};}
function python(args){const r=spawnSync('python',['-I','-B',...args],{env:cleanEnv(),encoding:'utf8',windowsHide:true,timeout:10000});if(r.error)throw r.error;return r;}
function docker(){const calls=[],states=new Map();let protocol=true;const execute=async args=>{calls.push(args);if(args[0]==='image')return {code:0,output:args.includes('--format')?JSON.stringify(protocol?{'agentdock.python.protocol':'1','agentdock.runtime.protocol':'3'}:{}):'ready'};if(args[0]==='run'){if(args.includes('--detach'))states.set(args[args.indexOf('--name')+1],Object.fromEntries(args.flatMap((value,i)=>value==='--label'?[args[i+1].split('=')]:[])));return {code:0,output:'Python fixture passed'};}if(args[0]==='inspect')return {code:0,output:args.includes('{{json .Config.Labels}}')?JSON.stringify(states.get(args.at(-1))):'true'};if(args[0]==='exec')return {code:0,output:JSON.stringify({status:200,headers:{'content-type':'application/json'},body:Buffer.from('{"ok":true}').toString('base64')})};if(args[0]==='rm'){states.delete(args.at(-1));return {code:0,output:'removed'};}throw Error('Unexpected command');};return {calls,execute,setProtocol:value=>protocol=value};}
test('five Python profiles provide valid exportable source, runtime definitions and supported requirements',()=>{
 for(const files of [pythonTemplate(),pythonTemplate('flask'),pythonTemplate('fastapi'),pythonTemplate('script'),reactPythonTemplate()]){assert.doesNotThrow(()=>validateFiles(files));assert.equal(projectLanguage(files),'python');assert.equal(runtimeDefinition(files).language,'python');assert.doesNotThrow(()=>pythonRequirements(files));assert.ok(files['test_app.py']||files['test_main.py']);}
 assert.equal(runtimeDefinition(reactPythonTemplate()).build,true);assert.equal(runtimeDefinition(pythonTemplate('script')).kind,'script');assert.throws(()=>pythonTemplate('unknown'));
});
test('Python dependency declarations reject downloads, flags, unsupported packages and mismatched pins',()=>{
 assert.deepEqual(pythonRequirements({'requirements.txt':'# comment\nFlask=='+PYTHON_PACKAGES.flask+'\npytest\n'}).map(p=>p.name),['flask','pytest']);
 for(const requirements of ['-r other.txt','--index-url https://example.invalid','git+https://example.invalid/repo','Flask>=3','Flask==0.1.0','unreviewed-package','constructor','https://user:secret@example.invalid/file.whl'])assert.throws(()=>pythonRequirements({'requirements.txt':requirements}));
});
test('Python source/config/data imports retain safe paths and continue to reject secret and binary paths',()=>{
 for(const file of ['app.py','tests/test_app.py','pyproject.toml','settings.yaml','data.csv','schema.sql','pytest.ini'])assert.equal(validatePath(file),file);for(const file of ['.env','.venv/site.py','../app.py','library.whl','private.pem'])assert.throws(()=>validatePath(file));
 for(const config of [{language:'bash',entry:'app.py'},{language:'python',entry:'app.js'},{language:'python',entry:'../app.py'},null])assert.throws(()=>runtimeDefinition({...pythonTemplate(),'agentdock.runtime.json':JSON.stringify(config)}));
});
test('Python jobs and web sessions preserve the existing container boundaries',()=>{
 for(const mode of ['python-syntax','python-test','python-pytest','python-run']){const args=containerArgs({name:'agentdock-job-'+'a'.repeat(24),image:'fixture',input:'C:\\fixture',mode});assert.ok(args.includes('--network=none'));assert.ok(args.includes('--read-only'));assert.ok(args.find(a=>a.startsWith('type=bind')).endsWith(',readonly'));assert.ok(args.at(-1).includes('/opt/agentdock/python_job.py'));assert.ok(!args.join(' ').includes('pip install'));}
 const args=liveContainerArgs({name:'agentdock-job-'+'b'.repeat(24),image:'fixture',input:'C:\\fixture',definition:runtimeDefinition(pythonTemplate()),lifetime:60000});assert.ok(args.includes('AGENTDOCK_LANGUAGE=python'));assert.ok(!args.includes('--publish'));assert.throws(()=>containerArgs({name:'agentdock-job-'+'a'.repeat(24),image:'fixture',input:'source',mode:'shell'}));
});
test('real Python AST checks all generated profiles without importing frameworks or executing source',async t=>{
 for(const files of [pythonTemplate(),pythonTemplate('flask'),pythonTemplate('fastapi'),pythonTemplate('script'),reactPythonTemplate()]){const dir=await sourceFolder(t,files),r=python([job,'syntax',dir.source,dir.work]);assert.equal(r.status,0,r.stderr+r.stdout);assert.match(r.stdout,/syntax passed/);}
 const dir=await sourceFolder(t,{'app.py':'raise RuntimeError("must not execute")\n'});assert.equal(python([job,'syntax',dir.source,dir.work]).status,0);await writeFile(path.join(dir.source,'app.py'),'def broken(:\n');assert.equal(python([job,'syntax',dir.source,dir.work]).status,1);
});
test('real Python unittest runner executes the stdlib and script starters and rejects zero-test success',async t=>{
 for(const files of [pythonTemplate(),pythonTemplate('script')]){const dir=await sourceFolder(t,files),r=python([job,'unittest',dir.source,dir.work]);assert.equal(r.status,0,r.stderr+r.stdout);assert.match(r.stderr,/OK/);}
 const dir=await sourceFolder(t,{'test_empty.py':'# no test cases\n'});assert.equal(python([job,'unittest',dir.source,dir.work]).status,5);
});
test('real Python script runner returns its JSON result and protects entry paths',async t=>{
 const dir=await sourceFolder(t,pythonTemplate('script')),r=python([job,'run',dir.source,dir.work]);assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{count:4,min:1,max:4,mean:2.5});
 const entry=fileURLToPath(new URL('../sandbox/python_entry.py',import.meta.url));const invalid=python([entry,job,dir.work]);assert.notEqual(invalid.status,0);
});
test('Python API jobs require approval and a prepared Python image; verification uses matching facts',async t=>{
 const d=docker(),{call,register}=await fixture(t,{config:{enableBuilds:true,enableServers:true},executeDocker:d.execute});const a=await register(),cookie=a.cookie,files=pythonTemplate();const run=mode=>call('/api/runtime/build',{method:'POST',cookie,body:{files,mode,confirm:true}});
 assert.equal((await call('/api/runtime/build',{method:'POST',cookie,body:{files,mode:'python-test'}})).status,400);assert.equal(d.calls.length,0);d.setProtocol(false);assert.equal((await run('python-syntax')).status,400);assert.equal(d.calls.some(args=>args[0]==='run'),false);d.setProtocol(true);
 const report=(await call('/api/verification',{method:'POST',cookie,body:{projectId:'python-1',files}})).data;assert.equal(report.kind,'python');assert.equal(report.execution.find(c=>c.mode==='python-syntax').status,'warn');
 for(const mode of ['python-syntax','python-test','python-pytest'])assert.equal((await run(mode)).data.ok,true);
 const updated=(await call('/api/verification/'+report.id,{cookie})).data;assert.equal(updated.execution.find(c=>c.mode==='python-syntax').status,'pass');assert.equal(updated.execution.find(c=>c.mode==='python-tests').runner,'python-pytest');
 const session=await call('/api/runtime/sessions',{method:'POST',cookie,body:{files,projectId:'python-1',confirm:true}});assert.equal(session.status,200,JSON.stringify(session.data));assert.ok(d.calls.some(args=>args.includes('AGENTDOCK_LANGUAGE=python')));assert.equal((await call('/api/runtime/sessions',{cookie})).data.sessions[0].state,'running');
});
test('Python script jobs do not become live backends and unsupported requirements never launch',async t=>{
 const d=docker(),{call,register}=await fixture(t,{config:{enableBuilds:true,enableServers:true},executeDocker:d.execute});const a=await register(),cookie=a.cookie;
 assert.equal((await call('/api/runtime/sessions',{method:'POST',cookie,body:{files:pythonTemplate('script'),confirm:true}})).status,400);assert.equal(d.calls.length,0);
 assert.equal((await call('/api/runtime/build',{method:'POST',cookie,body:{files:{...pythonTemplate(),'requirements.txt':'unreviewed'},mode:'python-test',confirm:true}})).status,400);assert.equal(d.calls.length,0);
 const info=await call('/api/runtime/environment',{method:'POST',cookie,body:{files:pythonTemplate('fastapi')}});assert.equal(info.status,200);assert.equal(info.data.language,'python');assert.equal(info.data.dependencies.length,2);assert.equal(d.calls.length,0);
});
test('trusted image Python requirements and exported starter pins match the catalog',async()=>{
 const requirements=await readFile(new URL('../sandbox/requirements.txt',import.meta.url),'utf8');const parsed=pythonRequirements({'requirements.txt':requirements});assert.deepEqual(Object.fromEntries(parsed.map(p=>[p.name,p.version])),PYTHON_PACKAGES);const dockerfile=await readFile(new URL('../sandbox/Dockerfile',import.meta.url),'utf8');assert.match(dockerfile,/--only-binary=:all:/);assert.match(dockerfile,/agentdock.python.protocol="1"/);
});
test('real Python HTTP starter serves its API and assets while withholding source/configuration',async t=>{
 const dir=await sourceFolder(t,pythonTemplate());const reservation=net.createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn('python',['-I','-B',fileURLToPath(new URL('../sandbox/python_entry.py',import.meta.url)),path.join(dir.source,'app.py'),dir.source],{env:{...cleanEnv(),PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});let exited=false;const done=new Promise(resolve=>{child.once('close',()=>{exited=true;resolve();});});t.after(async()=>{if(!exited)child.kill();await done;});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<30;i++){try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(300)});if(r.ok){assert.equal((await r.json()).service,'python-stdlib');ready=true;break;}}catch{}if(exited)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready,output);
 assert.equal((await fetch(base)).status,200);assert.equal((await fetch(base+'/app.js')).status,200);
 const reply=await fetch(base+'/api/echo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'verified Python POST'})});assert.deepEqual(await reply.json(),{message:'verified Python POST'});
 for(const file of ['app.py','test_app.py','requirements.txt','agentdock.runtime.json','../app.py','assets/%2e%2e%2fapp.py','assets/%5c..%5capp.py'])assert.equal((await fetch(base+'/'+file)).status,404,file);
 assert.equal((await fetch(base+'/api/echo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'x'.repeat(201)})})).status,400);
});
test('static hosting does not publish Python backend source as a website',async t=>{
 let externalCalls=0;const {call,register}=await fixture(t,{transport:async()=>{externalCalls++;throw Error('Must not upload Python source.');}});const a=await register(),cookie=a.cookie;await call('/api/workspace',{method:'PUT',cookie,body:{revision:0,state:workspace(pythonTemplate())}});
 const result=await call('/api/deploy/netlify',{method:'POST',cookie,body:{projectId:'project-1',confirm:true}});assert.equal(result.status,400);assert.match(result.data.error,/Python-capable host/);assert.equal(externalCalls,0);
});
