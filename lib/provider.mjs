// Credentials are read only on the server. No discovery/health request spends tokens.
export function providerConfiguration(env={}){
 const openaiModel=String(env.OPENAI_MODEL||'').trim();
 const configuredModel=openaiModel?(/^(openai|azure)\//.test(openaiModel)?openaiModel:'openai/'+openaiModel):String(env.LLM_MODEL||env.AI_MODEL||'').trim();
 if(openaiModel.startsWith('azure/'))throw Error('OPENAI_MODEL must use an openai/ prefix or an unprefixed model name.');
 const prefix=/^(openai|azure)\//.exec(configuredModel)?.[1];
 const azureFields=Boolean(env.AZURE_API_KEY||env.AZURE_API_BASE||env.AZURE_OPENAI_API_KEY||env.AZURE_OPENAI_ENDPOINT);
 const explicit=env.LLM_PROVIDER||'';
 if(explicit&&!['openai','azure'].includes(explicit))throw Error('LLM_PROVIDER must be openai or azure.');
 if(explicit&&prefix&&explicit!==prefix)throw Error('LLM_PROVIDER conflicts with the LLM_MODEL provider prefix.');
 const provider=explicit||prefix||(env.OPENAI_ENDPOINT?'openai':azureFields?'azure':'openai');
 if(env.OPENAI_ENDPOINT&&provider!=='openai')throw Error('OPENAI_ENDPOINT requires the OpenAI-compatible adapter.');
 const azureKey=env.AZURE_API_KEY||env.AZURE_OPENAI_API_KEY||'',azureBase=env.AZURE_API_BASE||env.AZURE_OPENAI_ENDPOINT||'';
 const openaiKey=env.AI_API_KEY||env.OPENAI_API_KEY||'';
 return {provider,configuredModel,aiModel:prefix?configuredModel.slice(prefix.length+1):configuredModel,
  aiKey:provider==='azure'?azureKey:(openaiKey||azureKey),
  // Select the base URL with its credential family. An unused AI_BASE_URL from
  // .env.example must never redirect an Azure-named credential elsewhere.
  aiBase:provider==='azure'?azureBase:env.OPENAI_ENDPOINT?env.OPENAI_ENDPOINT:openaiKey?(env.AI_BASE_URL||env.OPENAI_BASE_URL||'https://api.openai.com/v1'):azureKey?azureBase:(azureBase||env.AI_BASE_URL||'https://api.openai.com/v1'),
  azureStyle:env.AZURE_API_STYLE||'v1',azureVersion:env.AZURE_API_VERSION||'',
  tokenParameter:env.AI_TOKEN_PARAMETER||(prefix==='openai'?'max_tokens':'max_completion_tokens')};
}
export function providerRequest(config,messages,output,format='json'){
 const azure=config.provider==='azure';
 if(!['azure','openai'].includes(config.provider))throw Error('Unsupported provider adapter.');
 if(azure&&!['v1','legacy'].includes(config.azureStyle||'v1'))throw Error('AZURE_API_STYLE must be v1 or legacy.');
 const base=config.aiBase||'';if(!base)throw Error('Set the configured provider endpoint (OPENAI_ENDPOINT or AZURE_API_BASE).');
 let url=new URL(base);if(url.username||url.password||url.hash||[...url.searchParams.keys()].some(k=>!/^(api-version)$/.test(k)))throw Error('Provider URL must not contain credentials or arbitrary query parameters.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Provider requires HTTPS or a local endpoint.');
 let p=url.pathname.replace(/\/+$/,'');
 if(azure){
  const legacy=config.azureStyle==='legacy'||/\/deployments\//.test(p);
  if(legacy){
   const version=config.azureVersion||url.searchParams.get('api-version');if(!version)throw Error('Set AZURE_API_VERSION for the legacy Azure deployment API.');
   if(!/\/deployments\//.test(p)){p=p.replace(/\/openai(?:\/v1)?$/,'');p+='/openai/deployments/'+encodeURIComponent(config.aiModel);}
   if(!p.endsWith('/chat/completions'))p+='/chat/completions';
   url.searchParams.set('api-version',version);
  }else{
   if(!p.endsWith('/chat/completions')){if(!p.endsWith('/openai/v1'))p=p.replace(/\/openai$/,'')+'/openai/v1';p+='/chat/completions';}
  }
 }else if(!p.endsWith('/chat/completions'))p+='/chat/completions';
 url.pathname=p;
 const parameter=config.tokenParameter||'max_completion_tokens';if(!['max_completion_tokens','max_tokens'].includes(parameter))throw Error('AI_TOKEN_PARAMETER must be max_completion_tokens or max_tokens.');
 return {url,options:{method:'POST',headers:{'Content-Type':'application/json',...(azure?{'api-key':config.aiKey}:{Authorization:'Bearer '+config.aiKey})},body:JSON.stringify({model:config.aiModel,messages,[parameter]:output,...(format==='json'?{response_format:{type:'json_object'}}:{})}),signal:AbortSignal.timeout(55000),redirect:'error'}};
}

export function providerDiagnostics(config,{credentialPresent=Boolean(config.aiKey),credentialSource='server'}={}){
 const checks=[{name:'Credential present',status:credentialPresent?'pass':'warn',message:credentialPresent?'A credential is present; validity is checked only by an approved request.':'No credential is configured.'}];
 let endpointHost=null,authentication=null,requestFamily=null;
 try{
  const request=providerRequest(config,[],256);endpointHost=request.url.hostname;
  authentication=config.provider==='azure'?'api-key':'Bearer';
  requestFamily=config.provider==='azure'?(config.azureStyle==='legacy'||/\/deployments\//.test(request.url.pathname)?'Azure deployment API':'Azure OpenAI v1'):'OpenAI-compatible Chat Completions';
  checks.push({name:'Request adapter',status:'pass',message:requestFamily+' using '+authentication+' authentication. No request was sent.'});
  if(config.provider==='azure'&&['models.github.ai','models.inference.ai.azure.com'].includes(endpointHost))checks.push({name:'Endpoint compatibility',status:'warn',message:'This endpoint is OpenAI-compatible. Use an openai/ model prefix with the same base URL and credential.'});
  if(!config.aiModel)checks.push({name:'Model',status:'warn',message:'Set a deployment/model name.'});
 }catch{checks.push({name:'Request adapter',status:'warn',message:'Endpoint or adapter configuration is invalid. Check HTTPS, provider style and the required API version locally. Credentials and raw URLs are not displayed.'});}
 return {provider:config.provider,model:config.aiModel||null,endpointHost,authentication,requestFamily,tokenParameter:config.tokenParameter||'max_completion_tokens',credentialPresent,credentialSource,checks,noRequestMade:true};
}

function providerFailure(code,message,upstreamStatus){
 const error=Error(message+' No automatic retry.');error.code=code;error.status=502;
 if(Number.isInteger(upstreamStatus))error.upstreamStatus=upstreamStatus;return error;
}
export async function requestCompletion(transport,request){
 let response;
 try{response=await transport(request.url,request.options);}catch(error){throw providerFailure(error.name==='TimeoutError'||error.name==='AbortError'?'provider_timeout':'provider_network',error.name==='TimeoutError'||error.name==='AbortError'?'Provider request timed out; reservation retained.':'Unable to reach the configured provider; reservation retained.');}
 if(!response.ok){const status=response.status,hint=status===401?'Authentication was rejected. Check that the endpoint, provider adapter and key belong together.':status===403?'Access was denied for this resource/model.':status===404?'Endpoint or model/deployment was not found.':status===429?'The provider rate or quota limit was reached.':status>=500?'The provider reported a server error.':'The provider rejected the request parameters.';throw providerFailure('provider_http','Provider returned HTTP '+status+'. '+hint+' Reservation retained.',status);}
 let data;
 try{
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let bytes=0;
   try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>1048576){try{await reader.cancel();}catch{}throw providerFailure('provider_response_limit','Provider response exceeded the 1 MB limit; reservation retained.');}chunks.push(Buffer.from(item.value));}data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{reader.releaseLock();}
  }else{data=await response.json();if(Buffer.byteLength(JSON.stringify(data))>1048576)throw providerFailure('provider_response_limit','Provider response exceeded the 1 MB limit; reservation retained.');}
 }catch(error){if(error.code==='provider_response_limit')throw error;throw providerFailure('provider_invalid_response','Provider returned an unreadable or invalid JSON response; reservation retained.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw providerFailure('provider_invalid_response','Provider returned an invalid response object; reservation retained.');
 return data;
}
export function providerTokenUsage(data){const value=data?.usage?.total_tokens;return Number.isSafeInteger(value)&&value>=0?value:null;}
