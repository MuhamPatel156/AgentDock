import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import * as core from '../dist/core.mjs';
import * as workspaceTools from '../dist/workspace-tools.mjs';
import {projectLanguage,PYTHON_PACKAGES} from '../dist/environments.mjs';

async function harness({state='running',error,mutate=false}={}){
 let now=1000;const calls=[],messages=[],activity=[],consent={checked:true};
 const context={...core,...workspaceTools,projectLanguage,PYTHON_PACKAGES,crypto:{randomUUID},addEventListener(){},Date:class extends Date{static now(){return now;}},setTimeout(fn,ms){now+=ms;fn();},document:{querySelector:s=>s==='#live-consent'?consent:null}};
 context.calls=calls;context.messages=messages;context.events=activity;
 context.reply=async body=>{if(error)throw Error(error);if(mutate)context.controller.edit();return {id:'session',projectId:body.projectId,state:'starting'};};context.sessionState=state;
 let source=await readFile(new URL('../dist/studio.mjs',import.meta.url),'utf8');source=source.replace(/^import[^\n]*\n/gm,'').replace(/boot\(\);\s*$/,'');
 source+=`\nstate={projects:[{id:'one',name:'Fixture',files:starter(),checkpoints:[]}],active:'one'};online=true;user={id:'account'};render=()=>{};toast=m=>messages.push(m);activity=(...args)=>events.push(args);api=async(route,method,body)=>{calls.push({route,method,body});return globalThis.reply(body);};refreshLive=async()=>{liveSessions=[{id:'session',projectId:'one',state:sessionState}];};globalThis.controller={start:startLiveBackend,refresh:refreshRuntime,status:()=>runtimeState,failNetwork:()=>{view='runtime';api=async()=>{throw Error('Failed to fetch');};refreshLive=async()=>{throw Error('Failed to fetch');};},error:()=>liveError,busy:()=>liveBusy,preview:()=>useLivePreview,edit:()=>{current().files['app.js']+='\\n// edited';},markup:runtimePage};`;
 vm.runInNewContext(source,context,{timeout:1000});return {c:context.controller,calls,messages,activity,consent};
}

test('a ready backend consumes approval and opens only its matching source',async()=>{
 const h=await harness();await h.c.start();assert.equal(h.consent.checked,false);assert.equal(h.calls.length,1);assert.equal(h.c.preview(),true);assert.equal(h.c.busy(),false);assert.equal(h.c.error(),'');assert.equal(h.activity[0][1],'Backend session ready');
});
test('a backend readiness timeout is persistent and never recorded as ready',async()=>{
 const h=await harness({state:'starting'});await h.c.start();assert.match(h.c.error(),/45 seconds/);assert.equal(h.activity.length,0);assert.equal(h.c.preview(),false);assert.equal(h.c.busy(),false);assert.match(h.c.markup(),/role="alert"/);
});
test('a failed backend keeps a visible error and does not open a preview',async()=>{
 const h=await harness({state:'failed'});await h.c.start();assert.match(h.c.error(),/Backend failed/);assert.equal(h.c.preview(),false);assert.equal(h.activity.length,0);
});
test('source edited during startup is not replaced with an earlier preview',async()=>{
 const h=await harness({mutate:true});await h.c.start();assert.equal(h.c.preview(),false);assert.ok(h.messages.some(m=>m.includes('earlier source snapshot')));assert.ok(!h.calls[0].body.files['app.js'].endsWith('// edited'));
});
test('Docker startup errors are escaped and remain visible after the toast expires',async()=>{
 const h=await harness({error:'Docker <fixture> failed'});await h.c.start();assert.equal(h.c.error(),'Docker <fixture> failed');assert.match(h.c.markup(),/Docker &lt;fixture&gt; failed/);assert.ok(!h.c.markup().includes('Docker <fixture> failed'));
});
test('a lost Studio connection renders an unavailable status without claiming Docker stopped',async()=>{
 const h=await harness();h.c.failNetwork();await h.c.refresh();
 assert.equal(h.c.status().enabled,null);assert.match(h.c.error(),/session status is unavailable/);assert.match(h.c.markup(),/Docker execution is unavailable/);
 assert.ok(!h.c.markup().includes('Docker execution is disabled'));
});
