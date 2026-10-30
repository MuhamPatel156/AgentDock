import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {starter} from '../dist/core.mjs';
import {reactTemplate} from '../dist/templates.mjs';
import {sourceHash,createVerification} from '../lib/verification.mjs';
import {Store} from '../lib/store.mjs';
import {verificationMarkup} from '../dist/verification-ui.mjs';
const input=files=>({projectId:'project-1',projectName:'Verification fixture',files});
test('verification records static evidence without using AI or executing containers',async t=>{
 let calls=0;const {call,register}=await fixture(t,{transport:async()=>{calls++;throw Error('No external calls.');},executeDocker:async()=>{calls++;throw Error('No execution.');}});const a=await register();const result=await call('/api/verification',{method:'POST',cookie:a.cookie,body:input(starter())});
 assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.status,'checks-pending');assert.equal(result.data.staticChecks.every(c=>c.status==='pass'),true);assert.equal(result.data.browser.status,'not-run');assert.equal(result.data.execution.every(c=>c.status==='not-required'),true);assert.equal(result.data.sourceHash,sourceHash(starter()));assert.equal(calls,0);
});
test('verification reports are authenticated, same-origin and private to the owner',async t=>{
 const {call,register}=await fixture(t);assert.equal((await call('/api/verification')).status,401);const a=await register('alice'),b=await register('bob');const created=await call('/api/verification',{method:'POST',cookie:a.cookie,body:input(starter())}),route='/api/verification/'+created.data.id;
 assert.equal((await call(route,{cookie:b.cookie})).status,404);assert.equal((await call(route+'/browser',{method:'POST',cookie:b.cookie,body:{}})).status,404);assert.equal((await call('/api/verification?projectId=project-1',{cookie:b.cookie})).data.reports.length,0);assert.equal((await call(route,{cookie:a.cookie,origin:'null'})).status,403);
});
test('source fingerprints ignore object key order but change for any source edit',()=>{
 const files=starter(),reversed=Object.fromEntries(Object.entries(files).reverse());assert.equal(sourceHash(files),sourceHash(reversed));assert.notEqual(sourceHash(files),sourceHash({...files,'app.js':files['app.js']+'\n// edit'}));assert.throws(()=>sourceHash({...files,'../escape.js':'x'}));
});
test('browser results require matching source and every declared fixture step',async t=>{
 const {call,register}=await fixture(t);const a=await register(),files=starter();const r=(await call('/api/verification',{method:'POST',cookie:a.cookie,body:input(files)})).data,route='/api/verification/'+r.id+'/browser';
 const body={files,mode:'static',checks:[{name:'exists h1',status:'pass',message:''}]};assert.equal((await call(route,{method:'POST',cookie:a.cookie,body:{...body,files:{...files,'app.js':'// changed'}}})).status,409);
 for(const checks of [[],[{name:'invented',status:'pass',message:''}],[{name:'exists h1',status:'pass',message:7}]])assert.equal((await call(route,{method:'POST',cookie:a.cookie,body:{...body,checks}})).status,400);
 const saved=await call(route,{method:'POST',cookie:a.cookie,body});assert.equal(saved.data.status,'checks-passed');assert.equal(saved.data.browser.provenance,'browser-reported');assert.ok(saved.data.limitations.some(x=>x.includes('influenced')));
});
test('reports persist in SQLite without copying source or fixture input values',async t=>{
 const {call,register,dir}=await fixture(t);const a=await register(),files={...starter(),'private-notes.txt':'source-marker-not-for-report','agentdock.tests.json':JSON.stringify({steps:[{action:'input',selector:'#name',value:'fixture-input-marker'}]})};
 const report=(await call('/api/verification',{method:'POST',cookie:a.cookie,body:input(files)})).data;const second=new Store(path.join(dir,'studio.sqlite'));try{const stored=second.verification(a.user.id,report.id);assert.equal(stored.sourceHash,sourceHash(files));assert.ok(!JSON.stringify(stored).includes('source-marker-not-for-report'));assert.ok(!JSON.stringify(stored).includes('fixture-input-marker'));}finally{second.close();}
});
test('invalid fixture definitions and source syntax appear as attention items',async t=>{
 const {call,register}=await fixture(t);const a=await register();for(const fixtureText of ['', 'null','{"steps":[]}','{"steps":[null]}']){const r=await call('/api/verification',{method:'POST',cookie:a.cookie,body:input({...starter(),'agentdock.tests.json':fixtureText,'app.js':'const = ;'})});assert.equal(r.status,200);assert.equal(r.data.status,'needs-attention');assert.equal(r.data.fixtures[0].status,'warn');assert.ok(r.data.staticChecks.some(c=>c.name.includes('syntax')&&c.status==='warn'));}
});
test('only server-recorded container results for matching source satisfy execution stages',async t=>{
 let failNode=false;const artifact={'index.html':'<h1>Compiled fixture</h1>'};const executeDocker=async args=>({code:args[0]==='run'&&args.at(-1).includes('node --test')&&failNode?1:0,output:args[0]==='run'&&args.at(-1).includes('vite')?'\nAGENTDOCK_OUTPUT='+JSON.stringify(artifact):'fixture'});
 const {call,register,app}=await fixture(t,{config:{enableBuilds:true},executeDocker});const a=await register(),files=reactTemplate(),cookie=a.cookie;
 const report=(await call('/api/verification',{method:'POST',cookie,body:input(files)})).data;assert.equal(report.execution.every(c=>c.status==='not-run'),true);
 for(const mode of ['react-build','node-test'])assert.equal((await call('/api/runtime/build',{method:'POST',cookie,body:{files,mode,confirm:true}})).data.ok,true);
 let updated=(await call('/api/verification/'+report.id,{cookie})).data;assert.equal(updated.execution.every(c=>c.status==='pass'),true);assert.equal(updated.browser.status,'not-run');
 failNode=true;await call('/api/runtime/build',{method:'POST',cookie,body:{files,mode:'node-test',confirm:true}});app.store.db.prepare("UPDATE runs SET created=123 WHERE kind='container'").run();updated=(await call('/api/verification/'+report.id,{cookie})).data;assert.equal(updated.execution.find(c=>c.mode==='node-test').status,'warn');assert.equal(updated.status,'needs-attention');
 const edited=(await call('/api/verification',{method:'POST',cookie,body:input({...files,'server.mjs':files['server.mjs']+'\n// changed'})})).data;assert.equal(edited.execution.every(c=>c.status==='not-run'),true);
});
test('report retention preserves the newest 20 per project and 100 per account',async t=>{
 const {app,register}=await fixture(t),a=await register();const manager=createVerification({store:app.store,check:async()=>[]});let first;
 for(let p=0;p<6;p++)for(let n=0;n<22;n++){const r=await manager.create(a.user,{...input(starter()),projectId:'project-'+p});first??=r.id;}
 assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM verification_reports WHERE user_id=?').get(a.user.id).n,100);assert.equal(manager.list(a.user,'project-5').length,20);assert.throws(()=>manager.get(a.user,first),/unavailable/);
});
test('concurrent verification is bounded and failure frees the slot',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),store={saveVerification(){},run(){},runs(){return [];}};let fail=true;const manager=createVerification({store,check:async()=>{await gate;if(fail)throw Error('fixture parser failure');return [];}}),user={id:'fixture'};
 const first=manager.create(user,input(starter()));await assert.rejects(manager.create(user,input(starter())),/already running/);release();await assert.rejects(first,/fixture parser failure/);fail=false;assert.ok((await manager.create(user,input(starter()))).id);
});
test('verification UI warns about stale source, escapes report content and hides other projects',()=>{
 const report={id:'fixture',projectId:'p',projectName:'<script>bad</script>',sourceHash:'old',created:1,fileCount:3,status:'checks-passed',staticChecks:[{name:'<img onerror=1>',status:'pass',message:'<script>bad</script>'}],fixtures:[],execution:[],browser:{status:'not-run',checks:[]}};
 const html=verificationMarkup({project:{id:'p',name:'<script>bad</script>'},reports:[report,{...report,id:'foreign',projectId:'another',projectName:'other-user-marker'}],sourceHash:'new',online:true});assert.ok(html.includes('verification is out of date'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('other-user-marker'));assert.ok(html.includes('browser-reported'));
});
