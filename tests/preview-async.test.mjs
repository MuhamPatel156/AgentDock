import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {renderPreviewHTML} from '../lib/preview.mjs';
import {reactTemplate} from '../dist/templates.mjs';

test('React starter browser fixture tolerates a deferred state update',{timeout:2000},async()=>{
 const html=renderPreviewHTML('<head></head>','fixture'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],events={};
 const counter={textContent:'Count: 0',click(){setTimeout(()=>counter.textContent='Count: 1',40);}};
 let done;const result=new Promise(resolve=>done=resolve),parent={postMessage:message=>{if(message.type==='tests')done(message.data);}};
 runInNewContext(script,{parent,addEventListener:(name,fn)=>events[name]=fn,document:{querySelector:selector=>selector==='#counter'?counter:{textContent:'A working app'}},console:{log(){},warn(){},error(){}},setTimeout,Date,Promise});
 events.message({source:parent,data:{agentdock:'fixture',type:'test',steps:JSON.parse(reactTemplate()['agentdock.tests.json']).steps}});
 assert.ok((await result).every(check=>check.status==='pass'));
});
test('browser wait-text assertions wait for asynchronous UI changes',{timeout:2000},async()=>{const html=renderPreviewHTML('<head></head>','fixture');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];const events={},element={textContent:'loading'};let resolveResult;const result=new Promise(r=>resolveResult=r);const parent={postMessage:value=>{if(value.type==='tests')resolveResult(value.data);}};runInNewContext(script,{parent,addEventListener:(name,callback)=>events[name]=callback,document:{querySelector:()=>element},console:{log(){},warn(){},error(){}},setTimeout,Date,Promise});events.message({source:parent,data:{agentdock:'fixture',type:'test',steps:[{action:'wait-text',selector:'#status',contains:'ready',timeout:500}]}});setTimeout(()=>element.textContent='ready',40);assert.equal((await result)[0].status,'pass');});
