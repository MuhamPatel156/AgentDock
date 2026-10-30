import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {starter} from '../dist/core.mjs';
test('AI requires consent, enforces budgets, caches results and prevents concurrent calls',{timeout:10000},async t=>{
 let calls=0,received,release,entered;const providerEntered=new Promise(r=>entered=r);
 const transport=async(url,options)=>{calls++;received=JSON.parse(options.body);await new Promise(r=>{release=r;entered();});return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'A small change',summary:'Fixture only',files:{'app.js':'console.log("fixture");'}})}}],usage:{total_tokens:50}})};};
 const {call,register,app}=await fixture(t,{config:{aiKey:'fake',aiModel:'fixture'},transport});const account=await register();const task={files:starter(),prompt:'One small change.',confirm:true,dailyLimit:30000,outputLimit:4096};
 const post=body=>call('/api/agent',{method:'POST',cookie:account.cookie,body});
 assert.equal((await post({...task,confirm:false})).status,400);assert.equal(calls,0);
 assert.equal((await post({...task,dailyLimit:1000})).status,429);assert.equal(calls,0);
 const pending=post(task);await Promise.race([providerEntered,pending.then(r=>{throw Error('Unexpected response: '+JSON.stringify(r));})]);
 assert.equal((await post({...task,prompt:'A parallel task.'})).status,409);release();const proposal=await pending;assert.equal(proposal.status,200);assert.equal(received.max_completion_tokens,512);assert.equal(calls,1);assert.ok(proposal.data.reserved>512);
 const cached=await post(task);assert.equal(cached.data.cached,true);assert.equal(cached.data.reserved,0);assert.equal(calls,1);assert.equal(app.store.usage(account.user.id).used,proposal.data.reserved);
});
test('failed AI requests retain reservations, do not retry, and expose no provider secrets',async t=>{
 let calls=0;const {call,register,app}=await fixture(t,{config:{aiKey:'fake-secret-never-returned',aiModel:'fixture'},transport:async()=>{calls++;return {ok:false,status:429};}});const a=await register();
 const r=await call('/api/agent',{method:'POST',cookie:a.cookie,body:{files:starter(),prompt:'A small task.',confirm:true,dailyLimit:30000}});assert.equal(r.status,502);assert.equal(r.data.upstreamStatus,429);assert.equal(r.data.reservationRetained,true);assert.equal(r.data.providerAttempted,true);assert.equal(calls,1);assert.equal(app.store.usage(a.user.id).used,r.data.reserved);assert.ok(!JSON.stringify(r.data).includes('fake-secret-never-returned'));
});

test('network errors are sanitized in responses and activity while retaining the exact reservation',async t=>{
 let calls=0;const secret='private-transport-fixture';const {call,register,app}=await fixture(t,{config:{aiKey:secret,aiModel:'fixture'},transport:async()=>{calls++;throw Error('Key '+secret);}});const a=await register();
 const response=await call('/api/agent',{method:'POST',cookie:a.cookie,body:{files:starter(),prompt:'A small task.',confirm:true,dailyLimit:30000}});
 assert.equal(response.status,502);assert.equal(response.data.code,'provider_network');assert.equal(response.data.reserved,app.store.usage(a.user.id).used);assert.equal(calls,1);
 assert.ok(!JSON.stringify(response.data).includes(secret));assert.ok(!JSON.stringify(app.store.runs(a.user.id)).includes(secret));
});
test('provider diagnostics are owner-only and make zero provider calls',async t=>{
 let calls=0;const {call,register}=await fixture(t,{config:{aiKey:'private-fixture',aiModel:'fixture'},transport:async()=>{calls++;throw Error('No paid call allowed');}});const owner=await register('owner'),member=await register('member');
 assert.equal((await call('/api/provider/diagnostics')).status,401);assert.equal((await call('/api/provider/diagnostics',{cookie:member.cookie})).status,403);
 const response=await call('/api/provider/diagnostics',{cookie:owner.cookie});assert.equal(response.status,200);assert.equal(response.data.noRequestMade,true);assert.ok(!JSON.stringify(response.data).includes('private-fixture'));assert.equal(calls,0);
});
test('secret-bearing source and oversized context are rejected before provider transport',async t=>{
 let calls=0;const {call,register}=await fixture(t,{config:{aiKey:'fake',aiModel:'fixture'},transport:async()=>{calls++;throw Error('Must not be called.');}});const a=await register();
 for(const files of [{...starter(),'app.js':'const key="sk-abcdefghijklmnopqrstuvwxyz";'}, {...starter(),'app.js':'x'.repeat(12001)}]){assert.equal((await call('/api/agent',{method:'POST',cookie:a.cookie,body:{files,prompt:'A small task.',confirm:true}})).status,400);}assert.equal(calls,0);
});
test('application-agent inference requires explicit consent and shares the same budget ledger',async t=>{
 let calls=0,body;const {call,register,app}=await fixture(t,{config:{aiKey:'fake',aiModel:'fixture'},transport:async(url,options)=>{calls++;body=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'A fixture answer.'},finish_reason:'stop'}],usage:{total_tokens:20}})};}});const a=await register();const task={input:'Explain a small concept.',instructions:'Be concise.',outputLimit:256,dailyLimit:30000};
 assert.equal((await call('/api/inference',{method:'POST',cookie:a.cookie,body:task})).status,400);assert.equal(calls,0);
 const answer=await call('/api/inference',{method:'POST',cookie:a.cookie,body:{...task,confirm:true}});assert.equal(answer.status,200);assert.equal(answer.data.text,'A fixture answer.');assert.equal(body.response_format,undefined);assert.equal(calls,1);assert.equal(app.store.usage(a.user.id).used,answer.data.reserved);
});
test('owner pause blocks both agent routes before transport and remains owner-only',async t=>{let calls=0;const {call,register,app}=await fixture(t,{config:{aiKey:'fixture',aiModel:'fixture'},transport:async()=>{calls++;throw Error('Must not spend.');}});const owner=await register('owner'),member=await register('member');assert.equal((await call('/api/owner/ai-pause',{method:'POST',cookie:member.cookie,body:{paused:true}})).status,403);assert.equal((await call('/api/owner/ai-pause',{method:'POST',cookie:owner.cookie,body:{paused:true}})).data.paused,true);for(const [route,body]of [['/api/agent',{files:starter(),prompt:'A task',confirm:true}],['/api/inference',{input:'Hello',instructions:'Be concise',confirm:true}]])assert.equal((await call(route,{method:'POST',cookie:owner.cookie,body})).status,503);assert.equal(calls,0);assert.equal(app.store.usage(owner.user.id).used,0);assert.equal((await call('/api/status',{cookie:owner.cookie})).data.paused,true);await call('/api/owner/ai-pause',{method:'POST',cookie:owner.cookie,body:{paused:false}});assert.equal(app.store.aiPaused(),false);});
test('server pause lock cannot be overridden in the UI',async t=>{const {call,register}=await fixture(t,{config:{aiPaused:true}});const owner=await register();assert.equal((await call('/api/owner/ai-pause',{method:'POST',cookie:owner.cookie,body:{paused:false}})).status,400);assert.equal((await call('/api/status',{cookie:owner.cookie})).data.pauseLocked,true);});
