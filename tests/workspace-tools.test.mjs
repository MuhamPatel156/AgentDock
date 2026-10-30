import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import * as core from '../dist/core.mjs';
import * as tools from '../dist/workspace-tools.mjs';
import {pythonTemplate} from '../dist/python-templates.mjs';
import {fixture} from './helpers.mjs';

test('default file list hides known support files and preserves source, tests and user data',()=>{
 const files={...pythonTemplate(),'greeting.py':'','test_greeting.py':'','data/settings.json':'{}','notes.md':'','node_modules/pkg/index.js':'','build/bundle.js':''},before=structuredClone(files);
 const visible=tools.visibleSourceFiles(files);
 for(const name of ['app.py','test_app.py','greeting.py','test_greeting.py','index.html','data/settings.json','notes.md'])assert.ok(visible.includes(name),name);
 for(const name of ['agentdock.runtime.json','agentdock.tests.json','requirements.txt','node_modules/pkg/index.js','build/bundle.js'])assert.ok(!visible.includes(name),name);
 assert.equal(tools.visibleSourceFiles(files,{showAll:true}).length,Object.keys(files).length);
 assert.deepEqual(tools.visibleSourceFiles(files,{query:' RUNTIME '}),['agentdock.runtime.json']);
 assert.deepEqual(files,before);
});

test('file ordering alone does not invalidate completed output',()=>{
 const files={'z.py':'print(1)','a.py':'print(2)'},result={source:tools.workspaceSource(files)};
 assert.equal(tools.jobIsStale(result,{'a.py':files['a.py'],'z.py':files['z.py']}),false);
 assert.equal(tools.jobIsStale(result,{...files,'a.py':'print(3)'}),true);
});

async function controller(){
 const consent={checked:true},calls=[],messages=[],renders=[];
 const context={...core,...tools,crypto:{randomUUID},addEventListener(){},document:{querySelector:s=>s==='#workspace-run-consent'?consent:null}};
 let source=await readFile(new URL('../dist/studio.mjs',import.meta.url),'utf8');
 source=source.replace(/^import[^\n]*\n/gm,'').replace(/boot\(\);\s*$/,'');
 context.testFiles=pythonTemplate();context.calls=calls;context.messages=messages;context.renders=renders;
 source+=`\nstate={projects:[{id:'one',name:'Python',files:testFiles,checkpoints:[]}],active:'one'};user={id:'account'};online=true;file='app.py';tab='code';render=()=>renders.push(true);activity=()=>{};toast=m=>messages.push(m);api=async(route,method,body)=>{calls.push({route,method,body});return globalThis.reply(body);};globalThis.controller={run:runBuild,panel:runOutputPanel,result:()=>buildResult,files:()=>current().files,edit:()=>{current().files['app.py']+='\\n# edit';},switchProject:()=>{state.projects.push({id:'two',name:'Other',files:starter()});state.active='two';},seed:log=>{buildResult={projectId:'one',source:workspaceSource(current().files),completed:Date.now(),ok:false,mode:'python-file',log};}};`;
 context.reply=async()=>({ok:true,log:'Hello, Muham!\n',exitCode:0,mode:'python-file'});
 vm.runInNewContext(source,context,{timeout:1000});return {c:context.controller,context,consent,calls,messages};
}

test('editor run consumes approval once and submits the selected file with an immutable source snapshot',async()=>{
 const h=await controller();await h.c.run('python-file');
 assert.equal(h.calls.length,1);assert.equal(h.consent.checked,false);
 const call=h.calls[0];assert.equal(call.route,'/api/runtime/build');assert.equal(call.body.entry,'app.py');assert.equal(call.body.confirm,true);
 assert.match(h.c.panel(),/Hello, Muham!/);assert.match(h.c.panel(),/exit 0/);
 await assert.rejects(h.c.run('python-file'),/approval checkbox/);assert.equal(h.calls.length,1);
});

test('output escapes program text, labels outdated results and excludes another project',async()=>{
 const h=await controller();h.c.seed('<img src=x onerror=alert(1)>');
 assert.match(h.c.panel(),/&lt;img/);assert.ok(!h.c.panel().includes('<img src=x'));
 h.c.edit();assert.match(h.c.panel(),/Source changed since this run/);
 h.c.switchProject();assert.ok(!h.c.panel().includes('&lt;img'));assert.ok(!h.c.panel().includes('Source changed since this run'));
});

test('edits during a job do not change its submitted files or attach its output to current source',async()=>{
 const h=await controller();let finish;
 h.context.reply=()=>new Promise(resolve=>finish=resolve);
 const running=h.c.run('python-file');assert.match(h.c.panel(),/Waiting for output/);
 const submitted=h.calls[0].body.files['app.py'];h.c.edit();assert.equal(h.calls[0].body.files['app.py'],submitted);
 finish({ok:true,mode:'python-file',log:'old source output'});await running;
 assert.match(h.c.panel(),/Source changed since this run/);
});

test('failed requests are displayed in output without marking the run completed successfully',async()=>{
 const h=await controller();h.context.reply=async()=>{throw Error('Docker engine unavailable');};await h.c.run('python-file');
 assert.equal(h.c.result().ok,false);assert.match(h.c.panel(),/Docker engine unavailable/);assert.match(h.c.panel(),/>Failed</);
});

test('selected Python file uses a temporary script config and never counts as the full script verification',async t=>{
 let staged,executions=0;
 const executeDocker=async args=>{
  if(args[0]==='image')return {code:0,output:args.includes('--format')?'{"agentdock.python.protocol":"1"}':'ready'};
  if(args[0]==='run'){
   executions++;const mount=args.find(a=>a.startsWith('type=bind,source=')),source=mount.slice('type=bind,source='.length).split(',target=')[0];
   staged=JSON.parse(await readFile(source+'/agentdock.runtime.json','utf8'));
   return {code:0,output:'Hello from selected file\n'};
  }
  return {code:0,output:''};
 };
 const {call,register}=await fixture(t,{config:{enableBuilds:true},executeDocker});const account=await register(),cookie=account.cookie;
 const files={...pythonTemplate('script'),'greeting.py':'print("Hello from selected file")\n'},before=structuredClone(files);
 const run=body=>call('/api/runtime/build',{method:'POST',cookie,body:{files,mode:'python-file',confirm:true,...body}});
 for(const entry of ['../escape.py','missing.py','index.html','x.py; echo bad',null])assert.equal((await run({entry})).status,400);
 assert.equal((await run({entry:'greeting.py',confirm:false})).status,400);assert.equal(executions,0);
 const result=await run({entry:'greeting.py'});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.ok,true);assert.equal(result.data.entry,'greeting.py');assert.equal(result.data.exitCode,0);
 assert.deepEqual(staged,{language:'python',kind:'script',entry:'greeting.py'});assert.deepEqual(files,before);
 const report=(await call('/api/verification',{method:'POST',cookie,body:{projectId:'one',files}})).data;
 assert.equal(report.execution.find(e=>e.mode==='python-run').status,'not-run');
 assert.equal((await call('/api/workspace',{cookie})).data.state,null);
});
