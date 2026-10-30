import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID,webcrypto} from 'node:crypto';
import * as core from '../dist/core.mjs';
import * as templates from '../dist/templates.mjs';
import {verificationMarkup} from '../dist/verification-ui.mjs';
import {createVerification,sourceHash} from '../lib/verification.mjs';
async function harness({gate}={}){
 const reports=new Map(),calls=[],sent=[],messages=[],timers=new Map();let nextTimer=1;
 const store={saveVerification(_user,r){reports.set(r.id,structuredClone(r));},verification(_user,id){return structuredClone(reports.get(id));},updateVerification(_user,r){reports.set(r.id,structuredClone(r));},run(){},runs(){return [];}};
 const manager=createVerification({store,check:async()=>[]});
 const frame={contentWindow:{postMessage:message=>sent.push(structuredClone(message))}};
 const context={...core,...templates,verificationMarkup,crypto:{randomUUID,subtle:webcrypto.subtle},TextEncoder,AbortSignal,URL,Blob,console,addEventListener(){},setTimeout:fn=>{const id=nextTimer++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),document:{querySelector:selector=>selector==='#preview'?frame:null},fetch:async(route,options={})=>{calls.push(route);try{const data=JSON.parse(options.body||'{}');let report;if(route==='/api/verification'){if(gate)await gate();report=await manager.create({id:'fixture'},data);}else{const id=route.split('/')[3];report=manager.browser({id:'fixture'},id,data);}return {ok:true,json:async()=>structuredClone(report)};}catch(error){return {ok:false,status:error.status||400,json:async()=>({error:error.message})};}}};
 let source=await readFile(new URL('../dist/studio.mjs',import.meta.url),'utf8');source=source.replace(/^import[^\n]*\n/gm,'');assert.match(source,/boot\(\);\s*$/);source=source.replace(/boot\(\);\s*$/,'');
 const files=core.starter(),hash=sourceHash(files);
 source+=`\nrender=()=>{};activity=()=>{};toast=message=>testMessages.push(message);state={projects:[{id:'project-1',name:'Fixture',files:starter(),checkpoints:[]}],active:'project-1'};user={id:'fixture'};online=true;previewReady=true;nonce='fixture-nonce';previewSourceHash=${JSON.stringify(hash)};previewProjectId='project-1';globalThis.controller={run:runSmokeTests,complete:completeBrowserVerification,pending:()=>pendingBrowserReport,checks:()=>checks,edit:()=>{current().files['app.js']+='\\n// edited';}};`;
 context.testMessages=messages;vm.runInNewContext(source,context,{timeout:1000});return {controller:context.controller,calls,sent,messages,timers,reports};
}
test('frontend sends source-matched preview steps and persists returned evidence',async()=>{
 const h=await harness();await h.controller.run();assert.equal(h.sent.length,1);assert.equal(h.sent[0].agentdock,'fixture-nonce');assert.deepEqual(h.sent[0].steps,[{action:'exists',selector:'h1'}]);await h.controller.complete([{name:'exists h1',status:'pass',message:''}]);assert.equal(h.controller.pending(),null);assert.equal([...h.reports.values()][0].browser.status,'pass');assert.equal(h.controller.checks()[0].browser,true);assert.ok(h.calls.every(route=>route.startsWith('/api/verification')));
});
test('frontend refuses stale preview source before creating a report',async()=>{const h=await harness();h.controller.edit();await assert.rejects(h.controller.run(),/Preview does not match/);assert.equal(h.calls.length,0);assert.equal(h.sent.length,0);});
test('source edits during report creation prevent running checks against the old preview',async()=>{
 let release,entered;const blocked=new Promise(r=>release=r),ready=new Promise(r=>entered=r);const h=await harness({gate:async()=>{entered();await blocked;}});const running=h.controller.run();await ready;h.controller.edit();release();await assert.rejects(running,/Project or preview changed/);assert.equal(h.sent.length,0);assert.equal(h.controller.pending(),null);
});
test('source edits during browser checks retain old evidence without applying it to current checks',async()=>{
 const h=await harness();await h.controller.run();h.controller.edit();await h.controller.complete([{name:'exists h1',status:'pass',message:''}]);assert.equal([...h.reports.values()][0].browser.status,'pass');assert.equal(h.controller.checks().length,0);assert.ok(h.messages.some(message=>message.includes('earlier source')));
});
test('a preview timeout leaves the report pending and frees the next attempt',async()=>{
 const h=await harness();await h.controller.run();await assert.rejects(h.controller.run(),/current verification/);const pending=h.controller.pending();h.timers.get(pending.timer)();assert.equal(h.controller.pending(),null);assert.equal([...h.reports.values()][0].browser.status,'not-run');assert.ok(h.messages.some(m=>m.includes('timed out')));
});
