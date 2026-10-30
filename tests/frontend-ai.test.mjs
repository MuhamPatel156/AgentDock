import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import * as core from '../dist/core.mjs';
async function harness(){
 const consent={checked:true},prompt={value:'Change one heading.'},calls=[],renders=[],messages=[],proposals=[];
 const context={...core,crypto:{randomUUID},addEventListener(){},document:{querySelector:s=>s==='#ai-consent'?consent:s==='#prompt'?prompt:null},calls,renders,messages,proposals};
 context.answer=async()=>({title:'Small change',summary:'Review this change',files:{'app.js':'console.log("changed");'},reserved:1800,providerTokens:40});
 let source=await readFile(new URL('../dist/studio.mjs',import.meta.url),'utf8');source=source.replace(/^import[^\n]*\n/gm,'').replace(/boot\(\);\s*$/,'');
 source+=`\nstate={projects:[{id:'one',name:'Fixture',files:starter(),checkpoints:[]}],active:'one',settings:{dailyLimit:12000,outputLimit:256}};user={id:'account'};online=true;status={connected:true,paused:false,used:0,outputLimit:512};render=()=>renders.push(status.used);toast=m=>messages.push(m);activity=()=>{};propose=(...args)=>proposals.push(args);api=async(route,method,body)=>{calls.push({route,body});return route==='/api/status'?{connected:true,used:1800,outputLimit:512}:globalThis.answer(body);};globalThis.controller={ask:askAI,outcome:()=>aiOutcome,markup:assistantPanel,files:()=>current().files,switchAccount:()=>{user={id:'other'};}};`;
 vm.runInNewContext(source,context,{timeout:1000});return {c:context.controller,context,consent,calls,renders,messages,proposals};
}
test('AI failure refreshes visible token accounting and preserves an escaped failure result',async()=>{
 const h=await harness();h.context.answer=async()=>{throw Object.assign(Error('HTTP 401 <fixture>'),{reserved:1800,reservationRetained:true,providerAttempted:true});};await h.c.ask();
 assert.equal(h.calls.filter(c=>c.route==='/api/agent').length,1);assert.equal(h.calls.filter(c=>c.route==='/api/status').length,1);assert.equal(h.renders.at(-1),1800);assert.equal(h.proposals.length,0);
 assert.match(h.c.markup(),/1800 \(retained\)/);assert.match(h.c.markup(),/&lt;fixture&gt;/);assert.ok(!h.c.markup().includes('HTTP 401 <fixture>'));
});
test('successful AI output remains a proposal and reports actual tokens separately from reservations',async()=>{
 const h=await harness(),before=JSON.stringify(h.c.files());await h.c.ask();assert.equal(h.proposals.length,1);assert.equal(JSON.stringify(h.c.files()),before);assert.equal(h.c.outcome().providerTokens,40);assert.match(h.c.markup(),/Provider-reported tokens: 40/);assert.equal(h.renders.at(-1),1800);
});
test('missing approval makes no model request and account changes cannot expose an earlier response',async()=>{
 const h=await harness();h.consent.checked=false;await assert.rejects(h.c.ask(),/Approve one API/);assert.equal(h.calls.length,0);
 h.consent.checked=true;h.context.answer=async()=>{h.c.switchAccount();return {title:'Private response',files:{},reserved:1800};};await h.c.ask();assert.equal(h.proposals.length,0);assert.equal(h.c.outcome(),null);assert.ok(!h.c.markup().includes('Private response'));
});
