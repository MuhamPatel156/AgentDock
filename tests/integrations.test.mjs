import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntegrations} from '../lib/integrations.mjs';
import {starter} from '../dist/core.mjs';
test('GitHub writes one commit on the existing tree and never force pushes',async()=>{
 const requests=[];const responses=[{object:{sha:'old-head'}},{tree:{sha:'base-tree'}},{sha:'new-tree'},{sha:'new-head'},{}];
 const transport=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>responses.shift()};};
 const api=createIntegrations({githubToken:'fake',githubRepo:'owner/repo',githubBranch:'main'},transport);
 const result=await api.push({admin:true},{confirm:true,repository:'owner/repo'},starter());assert.equal(result.sha,'new-head');assert.equal(requests.length,5);assert.equal(JSON.parse(requests[2].options.body).base_tree,'base-tree');assert.deepEqual(JSON.parse(requests[4].options.body),{sha:'new-head',force:false});
});
test('external integrations cannot use owner credentials without authority and target consent',async()=>{
 let calls=0;const api=createIntegrations({githubToken:'fake',githubRepo:'owner/repo',netlifyToken:'fake',netlifySite:'site'},async()=>{calls++;});
 await assert.rejects(()=>api.push({admin:false},{confirm:true,repository:'owner/repo'},starter()));await assert.rejects(()=>api.push({admin:true},{confirm:false,repository:'owner/repo'},starter()));await assert.rejects(()=>api.deploy({admin:true},{confirm:true,site:'wrong-site'},starter()));assert.equal(calls,0);
});
test('Netlify receives a bounded ZIP payload and returns submitted state without claiming readiness',async()=>{
 let captured;const api=createIntegrations({netlifyToken:'fake',netlifySite:'fixture-site'},async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({id:'deploy-1',state:'processing',deploy_ssl_url:'https://fixture.netlify.app'})};});
 const r=await api.deploy({admin:true},{confirm:true,site:'fixture-site'},starter());assert.equal(r.state,'processing');assert.equal(captured.options.headers['Content-Type'],'application/zip');assert.equal(captured.options.body.readUInt32LE(0),0x04034b50);
});
