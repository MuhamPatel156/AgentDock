import test from 'node:test';
import assert from 'node:assert/strict';
import {providerRequest,providerDiagnostics,requestCompletion,providerTokenUsage} from '../lib/provider.mjs';
import {environment} from '../server.mjs';
const azure={provider:'azure',aiKey:'fake-key',aiModel:'my-deployment',aiBase:'https://example.openai.azure.com',azureStyle:'v1'};
test('CrewAI-style openai prefix selects bearer authentication while retaining Azure variable values',()=>{
 const c=environment({LLM_MODEL:'openai/gpt-4.1-mini',AZURE_API_KEY:'fixture-key',AZURE_API_BASE:'https://example.services.ai.azure.com/openai/v1'});
 const request=providerRequest(c,[],256),body=JSON.parse(request.options.body);
 assert.equal(c.provider,'openai');assert.equal(c.aiModel,'gpt-4.1-mini');assert.equal(request.url.href,'https://example.services.ai.azure.com/openai/v1/chat/completions');
 assert.equal(request.options.headers.Authorization,'Bearer fixture-key');assert.equal(request.options.headers['api-key'],undefined);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.max_tokens,256);
});
test('provider selection rejects contradictory prefixes and never sends an Azure fallback key to a default OpenAI URL',()=>{
 assert.throws(()=>environment({LLM_PROVIDER:'azure',LLM_MODEL:'openai/fixture'}),/conflicts/);
 assert.throws(()=>environment({LLM_PROVIDER:'unknown'}),/must be/);
 const c=environment({LLM_MODEL:'openai/fixture',AZURE_API_KEY:'fixture-key'});assert.equal(c.aiBase,'');assert.throws(()=>providerRequest(c,[],256));
 assert.equal(environment({LLM_MODEL:'azure/deployment',AZURE_API_BASE:azure.aiBase}).aiModel,'deployment');
 const paired=environment({LLM_MODEL:'openai/fixture',AZURE_API_KEY:'fixture-key',AZURE_API_BASE:'https://resource.services.ai.azure.com/openai/v1',AI_BASE_URL:'https://unused.invalid/v1'});
 assert.equal(providerRequest(paired,[],256).url.hostname,'resource.services.ai.azure.com');
});
test('read-only diagnostics omit credentials and invalid raw URLs',()=>{
 for(const aiBase of [azure.aiBase,'https://user:private-fixture@example.com/?api-key=private-fixture']){
  const result=providerDiagnostics({...azure,aiBase,aiKey:'private-fixture'}),text=JSON.stringify(result);
  assert.equal(result.noRequestMade,true);assert.ok(!text.includes('private-fixture'));assert.ok(!text.includes('encryptedKey'));
 }
});
test('upstream errors and transport exceptions never echo raw provider bodies or credentials',async()=>{
 const request=providerRequest(azure,[],256);let bodyRead=false,calls=0;
 await assert.rejects(requestCompletion(async()=>{calls++;return {ok:false,status:401,json:async()=>{bodyRead=true;return {error:'private-fixture'};}};},request),error=>error.status===502&&error.upstreamStatus===401&&!error.message.includes('private-fixture'));
 assert.equal(bodyRead,false);assert.equal(calls,1);
 await assert.rejects(requestCompletion(async()=>{throw Error('Authorization Bearer private-fixture');},request),error=>error.code==='provider_network'&&!error.message.includes('private-fixture'));
});
test('provider responses have a byte limit and malformed JSON is sanitized',async()=>{
 const request=providerRequest(azure,[],256);
 await assert.rejects(requestCompletion(async()=>new Response('x'.repeat(1048577)),request),error=>error.code==='provider_response_limit');
 await assert.rejects(requestCompletion(async()=>new Response('private-fixture invalid JSON'),request),error=>error.code==='provider_invalid_response'&&!error.message.includes('private-fixture'));
 assert.equal(providerTokenUsage({usage:{total_tokens:42}}),42);for(const total_tokens of [-1,'42',1.5,null,Infinity])assert.equal(providerTokenUsage({usage:{total_tokens}}),null);
});
test('user Azure variable names map to server configuration without a request',()=>{const c=environment({LLM_MODEL:'deployment-a',AZURE_API_KEY:'fixture-key',AZURE_API_BASE:'https://example.openai.azure.com'});assert.equal(c.provider,'azure');assert.equal(c.aiModel,'deployment-a');assert.equal(c.aiKey,'fixture-key');});
test('Azure v1 resource URLs use deployment name and api-key authentication',()=>{const r=providerRequest(azure,[],512);assert.equal(r.url.href,'https://example.openai.azure.com/openai/v1/chat/completions');assert.equal(r.options.headers['api-key'],'fake-key');assert.equal(r.options.headers.Authorization,undefined);assert.equal(JSON.parse(r.options.body).model,'my-deployment');assert.equal(JSON.parse(r.options.body).max_completion_tokens,512);});
test('Azure v1 accepts already normalized and Foundry endpoints without duplicating paths',()=>{for(const base of ['https://example.openai.azure.com/openai/v1/','https://example.services.ai.azure.com/openai/v1'])assert.equal(providerRequest({...azure,aiBase:base},[],256).url.pathname,'/openai/v1/chat/completions');});
test('legacy Azure requests require an explicit API version',()=>{assert.throws(()=>providerRequest({...azure,azureStyle:'legacy'},[],256),/VERSION/);const r=providerRequest({...azure,azureStyle:'legacy',azureVersion:'2024-10-21'},[],256);assert.equal(r.url.pathname,'/openai/deployments/my-deployment/chat/completions');assert.equal(r.url.searchParams.get('api-version'),'2024-10-21');});
test('full legacy target URIs preserve their deployment and API version',()=>{const r=providerRequest({...azure,aiBase:'https://example.openai.azure.com/openai/deployments/existing/chat/completions?api-version=2024-10-21'},[],256);assert.equal(r.url.pathname,'/openai/deployments/existing/chat/completions');assert.equal(r.url.searchParams.get('api-version'),'2024-10-21');});
test('OpenAI-compatible providers keep bearer authentication and explicit output bounds',()=>{const r=providerRequest({provider:'openai',aiKey:'fake',aiBase:'https://fake.invalid/v1',aiModel:'fixture',tokenParameter:'max_tokens'},[],300);assert.equal(r.options.headers.Authorization,'Bearer fake');assert.equal(r.url.pathname,'/v1/chat/completions');assert.equal(JSON.parse(r.options.body).max_tokens,300);});
test('provider URLs reject embedded credentials, secret queries and insecure remote HTTP',()=>{for(const base of ['https://user:password@example.com','https://example.com/?api-key=secret','http://example.com'])assert.throws(()=>providerRequest({...azure,aiBase:base},[],256));});

test('OPENAI_MODEL and OPENAI_ENDPOINT select compatible routing without Azure additions',()=>{
 for(const model of ['gpt-4.1-mini','openai/gpt-4.1-mini']){
 const c=environment({OPENAI_MODEL:model,OPENAI_ENDPOINT:'https://example.test/custom/v1',AZURE_API_KEY:'fixture',LLM_MODEL:'azure/stale',AZURE_API_BASE:'https://unused.invalid',AI_BASE_URL:'https://unused.invalid'});
 assert.equal(c.configuredModel,'openai/gpt-4.1-mini');assert.equal(c.provider,'openai');
 const r=providerRequest(c,[],256);assert.equal(r.url.href,'https://example.test/custom/v1/chat/completions');assert.equal(r.options.headers.Authorization,'Bearer fixture');assert.equal(r.options.headers['api-key'],undefined);assert.equal(JSON.parse(r.options.body).model,'gpt-4.1-mini');
 }
 assert.throws(()=>environment({OPENAI_MODEL:'azure/model'}),/OPENAI_MODEL/);
 assert.throws(()=>environment({OPENAI_MODEL:'gpt-4.1-mini',LLM_PROVIDER:'azure'}),/conflicts/);
 assert.throws(()=>environment({LLM_MODEL:'azure/model',OPENAI_ENDPOINT:'https://example.test/v1'}),/OPENAI_ENDPOINT/);
});
