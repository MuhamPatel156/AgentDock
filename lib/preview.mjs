import path from 'node:path';
export const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain','.md':'text/plain'};
export function previewHeaders(live=false){return {'Content-Security-Policy':`sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${live?"'self'":"'none'"}; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`,'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};}
export function renderPreviewHTML(source,nonce,base=''){
 if(base)source=source.replace(/\b(src|href|action)\s*=\s*(["'])\/(?!\/)([^"']*)\2/gi,(_,key,q,value)=>`${key}=${q}${base}${value}${q}`);
 source=source.replace(/<script\b([^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*)>/gi,(_,attrs)=>'<script'+attrs.replace(/\s+crossorigin(?:\s*=\s*(?:["'][^"']*["']|[^\s>]+))?/gi,'')+' crossorigin="anonymous">');
 const bridge=nonce?`<script>(${bridgeScript.toString()})(${JSON.stringify(nonce)},${JSON.stringify(base)});</script>`:'';
 const head=/<head\b[^>]*>/i;if(head.test(source))return source.replace(head,match=>match+bridge);return bridge+source;
}
export function servePreview(res,files,filename,nonce){
 let source=files[filename];if(source===undefined){res.writeHead(404);res.end('File not in this snapshot.');return;}
 if(filename.endsWith('.html'))source=renderPreviewHTML(source,nonce);
 res.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'text/plain',...previewHeaders()});res.end(source);
}
function bridgeScript(nonce,base){
 const send=(type,data)=>parent.postMessage({agentdock:nonce,type,data},'*');
 if(base){const originalFetch=window.fetch.bind(window),root=new URL(base,location.href);window.fetch=(input,init={})=>{
  try{const request=input instanceof Request?input:null,value=request?request.url:String(input),target=new URL(value,location.href);if(target.origin!==root.origin)throw Error('External network access is disabled in this preview.');
   if(!target.pathname.startsWith(root.pathname)){if(!value.startsWith('/')||value.startsWith('//'))throw Error('Fetch target must stay inside the backend preview.');target.pathname=root.pathname+target.pathname.replace(/^\//,'');}
   const options={...(request?{method:request.method,headers:request.headers,...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})}:{}),...init,credentials:'omit'};
   return originalFetch(target.href,options);
  }catch(error){return Promise.reject(error);}
 };}
 addEventListener('error',e=>send('error',(String(e.message)+(e.lineno?' (line '+e.lineno+')':'')).slice(0,500)));
 addEventListener('unhandledrejection',e=>send('error',String(e.reason).slice(0,500)));
 for(const level of ['log','warn','error']){const original=console[level];console[level]=(...args)=>{original.apply(console,args);send('console',{level,text:args.map(a=>{try{return typeof a==='string'?a:JSON.stringify(a);}catch{return '[unserializable]';}}).join(' ').slice(0,1000)});};}
 addEventListener('DOMContentLoaded',()=>send('ready',{title:document.title}));
 let testing=false;
 addEventListener('message',async e=>{
  if(e.source!==parent||e.data?.agentdock!==nonce||e.data?.type!=='test'||testing||!Array.isArray(e.data.steps))return;
  testing=true;const results=[],deadline=Date.now()+20000;
  try{for(const step of e.data.steps.slice(0,30)){
   try{
    if(!['exists','click','text','input','wait-text'].includes(step.action))throw Error('Unsupported test action.');
    if(Date.now()>deadline)throw Error('Test run exceeded 20 seconds.');
    let el=document.querySelector(step.selector);
    if(step.action==='wait-text'){
     const until=Math.min(deadline,Date.now()+Math.max(50,Math.min(5000,Number(step.timeout)||3000)));
     while((!el||!el.textContent.includes(step.contains))&&Date.now()<until){await new Promise(resolve=>setTimeout(resolve,50));el=document.querySelector(step.selector);}
     if(!el||!el.textContent.includes(step.contains))throw Error('Timed out waiting for text: '+step.contains);
    }else{
     if(!el)throw Error('Selector not found: '+step.selector);
     if(step.action==='click')el.click();
     else if(step.action==='text'&&!el.textContent.includes(step.contains))throw Error('Text did not contain: '+step.contains);
     else if(step.action==='input'){el.value=step.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    results.push({name:step.action+' '+step.selector,status:'pass',message:''});
   }catch(error){results.push({name:step.action+' '+step.selector,status:'warn',message:error.message});}
  }}finally{testing=false;send('tests',results);}
 });
}
