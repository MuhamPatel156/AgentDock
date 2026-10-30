import {starter,catalog,validateFiles,validatePath,validateWorkspace,validateComponent,changedFiles,insertComponent,localChecks,repairMetadata} from './core.mjs';
import {assistantTemplate,reactTemplate} from './templates.mjs';
import {verificationMarkup} from './verification-ui.mjs';
import {pythonTemplate,reactPythonTemplate} from './python-templates.mjs';
import {projectLanguage,PYTHON_PACKAGES} from './environments.mjs';
import {isSupportFile,visibleSourceFiles,matchingJob,jobIsStale,workspaceSource} from './workspace-tools.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),id=()=>crypto.randomUUID();
const paths={code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-15-2 20',grid:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',layers:'m12 3 10 6-10 6L2 9l10-6ZM2 15l10 6 10-6M2 12l10 6 10-6',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',settings:'M3 7h18M3 17h18M9 4v6m6 4v6',arrow:'M5 12h14m-5-5 5 5-5 5',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',leaf:'M20 3S4 2 4 12c0 4 3 7 7 7C21 19 20 3 20 3ZM4 21 16 8',monitor:'M2 3h20v14H2V3Zm6 18h8m-4-4v4',phone:'M6 2h12v20H6V2Zm4 16h4',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',refresh:'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',folder:'M3 7V4h7l3 3h8v13H3V7Z',spark:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',close:'m6 6 12 12M18 6 6 18',warn:'m12 3 10 18H2L12 3ZM12 9v5m0 3v1',sun:'M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',sidebar:'M3 3h18v18H3V3zm6 0v18',maximize:'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',search:'m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',command:'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',filter:'M22 3H2l8 9.46V19l4 2v-8.54L22 3z'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="${paths[n]||paths.code}"/></svg>`;
function fresh(){const p={id:id(),name:'My first application',files:starter(),updated:Date.now(),checkpoints:[]};return {projects:[p],active:p.id,components:[],history:[],settings:{dailyLimit:12000,outputLimit:1200}};}
let state=fresh(),user=null,online=false,status=null,revision=0,view='workspace',tab='preview',file='index.html',mobile=false;let theme=(typeof localStorage!=='undefined'&&localStorage.getItem('agentdock.theme'))||((typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches)?'dark':'light');function applyTheme(next){theme=next;if(typeof document!=='undefined'&&document.documentElement){document.documentElement.setAttribute('data-theme',theme);}try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.theme',theme);}catch{}}applyTheme(theme);
let codeTheme=(typeof localStorage!=='undefined'&&localStorage.getItem('agentdock.code-theme'))||(theme==='dark'?'obsidian':'vs-dark');
function applyCodeTheme(next){
 codeTheme=next;
 if(typeof document!=='undefined'&&document.documentElement){document.documentElement.setAttribute('data-code-theme',codeTheme);}
 try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.code-theme',codeTheme);}catch{}
}
applyCodeTheme(codeTheme);
let searchMatches=[],currentMatchIdx=-1,matchCase=false,consoleFilter='all';
let sidebarCollapsed=(typeof localStorage!=='undefined'&&localStorage.getItem('agentdock.sidebar-collapsed')==='true')||false;
let editorMaximized=false;
let openTabs=(typeof localStorage!=='undefined'&&JSON.parse(localStorage.getItem('agentdock.open-tabs')||'null'))||['index.html'];
let sidebarWidth=220;
try{
 const savedW=parseInt(typeof localStorage!=='undefined'?localStorage.getItem('agentdock.sidebar-width')||'':'',10);
 if(savedW>=160&&savedW<=550)sidebarWidth=savedW;
}catch{}

function applySidebarWidth(w,save=true){
 const winW=typeof window!=='undefined'?window.innerWidth:1200;
 const minMain=Math.max(480,Math.floor(winW*0.52));
 const maxW=Math.max(260,Math.min(520,winW-minMain));
 const clamped=Math.max(160,Math.min(maxW,w));
 sidebarWidth=clamped;
 if(typeof document!=='undefined'&&document.documentElement){
  document.documentElement.style.setProperty('--sidebar',`${clamped}px`);
 }
 if(save){
  try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.sidebar-width',String(clamped));}catch{}
 }
}
applySidebarWidth(sidebarWidth,false);

function applySidebarState(){
 if(typeof document!=='undefined'&&document.body){
  document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);
  if(!sidebarCollapsed)applySidebarWidth(sidebarWidth,false);
 }
 try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.sidebar-collapsed',String(sidebarCollapsed));}catch{}
}

function initSidebarResizer(){
 const resizer=document.getElementById('sidebar-resizer');
 if(!resizer)return;

 let dragging=false,startX=0,startW=sidebarWidth;

 const getBounds=()=>{
  const winW=typeof window!=='undefined'?window.innerWidth:1200;
  const minMain=Math.max(480,Math.floor(winW*0.52));
  const maxW=Math.max(260,Math.min(520,winW-minMain));
  return {minW:160,maxW};
 };

 const onMove=e=>{
  if(!dragging)return;
  const delta=e.clientX-startX;
  const {minW,maxW}=getBounds();
  const clamped=Math.max(minW,Math.min(maxW,startW+delta));
  applySidebarWidth(clamped,false);
 };

 const onUp=e=>{
  if(!dragging)return;
  dragging=false;
  try{resizer.releasePointerCapture(e.pointerId);}catch{}
  window.removeEventListener('pointermove',onMove);
  window.removeEventListener('pointerup',onUp);
  window.removeEventListener('pointercancel',onUp);
  if(typeof document!=='undefined'&&document.body){
   document.body.classList.remove('sidebar-resizing');
  }
  applySidebarWidth(sidebarWidth,true);
 };

 resizer.onpointerdown=e=>{
  if(e.button!==0)return;
  dragging=true;
  startX=e.clientX;
  startW=sidebarWidth;
  if(sidebarCollapsed){sidebarCollapsed=false;applySidebarState();}
  try{resizer.setPointerCapture(e.pointerId);}catch{}
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',onUp);
  if(typeof document!=='undefined'&&document.body){
   document.body.classList.add('sidebar-resizing');
  }
  e.preventDefault();
 };

 resizer.ondblclick=()=>{
  applySidebarWidth(220,true);
  toast('Sidebar reset to default (220px)');
 };

 resizer.onkeydown=e=>{
  const {minW,maxW}=getBounds();
  if(e.key==='ArrowRight'){e.preventDefault();applySidebarWidth(Math.min(maxW,sidebarWidth+15),true);}
  else if(e.key==='ArrowLeft'){e.preventDefault();applySidebarWidth(Math.max(minW,sidebarWidth-15),true);}
  else if(e.key==='Home'){e.preventDefault();applySidebarWidth(minW,true);}
  else if(e.key==='End'){e.preventDefault();applySidebarWidth(maxW,true);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();applySidebarWidth(220,true);toast('Sidebar reset to default (220px)');}
 };
}

function ensureOpenTabs(){
 const currentNames=names();
 openTabs=openTabs.filter(f=>currentNames.includes(f));
 if(!openTabs.length)openTabs=['index.html'];
 if(!openTabs.includes(file))openTabs.push(file);
 try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.open-tabs',JSON.stringify(openTabs));}catch{}
}

function openTab(filename){
 ensureOpenTabs();
 if(!openTabs.includes(filename))openTabs.push(filename);
 file=filename;
 ensureOpenTabs();
 render();
}

function closeTab(filename){
 ensureOpenTabs();
 openTabs=openTabs.filter(f=>f!==filename);
 if(!openTabs.length)openTabs=['index.html'];
 if(file===filename)file=openTabs[openTabs.length-1]||'index.html';
 ensureOpenTabs();
 render();
}
let shared=[],runs=[],releases=[],checks=[],logs=[],nonce='',busy=false,previewSequence=0,saveTimer,syncPromise=null,syncBlocked=false,editSequence=0,savedSequence=0,saveMessage='Browser only';
let previewReady=false,previewTimer,aiDraft='',role='builder',contextFiles=null;
let inferencePending=false,aiOutcome=null;
let runtimeState=null,buildResult=null,compiled=null,buildBusy=false;
let verificationReports=[],verificationHash='',verificationSelected=null,verificationBusy=false,pendingBrowserReport=null,previewSourceHash='',previewProjectId='';
let liveSessions=[],liveEnabled=false,liveBusy=false,useLivePreview=false,liveError='';
let showSupportFiles=false,fileQuery='',runningJob=null;
let termHistory=[{text:'AgentDock Sandboxed Terminal v0.2',err:false},{text:'Type "help" to inspect available commands.\n',err:false}];
let termBusy=false;
function updateLineNumbers(){
 const ed=$('#editor'),ln=$('#line-numbers');
 if(!ed||!ln)return;
 const count=(ed.value||'').split('\n').length;
 let nums='';
 for(let i=1;i<=count;i++)nums+=i+'\n';
 ln.textContent=nums;
 ln.scrollTop=ed.scrollTop;const hl=$('#editor-highlight');if(hl){hl.scrollTop=ed.scrollTop;hl.scrollLeft=ed.scrollLeft;}
}
function updateHighlight(){
 const ed=$('#editor'),codeEl=$('#highlight-code'),hl=$('#editor-highlight');
 if(!ed||!codeEl)return;
 codeEl.innerHTML=highlightSyntax(ed.value||'',file);
 if(hl){hl.scrollTop=ed.scrollTop;hl.scrollLeft=ed.scrollLeft;}
}

function highlightSyntax(code,filename){
 if(!code)return '';
 const ext=(filename.split('.').pop()||'').toLowerCase();
 if(ext==='html'||ext==='htm'||ext==='svg')return highlightHtml(code);
 if(ext==='css')return highlightCss(code);
 if(ext==='py')return highlightPython(code);
 if(ext==='json')return highlightJson(code);
 return highlightJs(code);
}

function highlightHtml(code){
 const regex=/(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\/?)([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*)(\/?>)/gi;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,doctype,tagOpen,tagName,tagAttrs,tagClose]=match;
  if(com)out+=`<span class="tok-com">${esc(com)}</span>`;
  else if(doctype)out+=`<span class="tok-doctype">${esc(doctype)}</span>`;
  else if(tagName){
   out+=esc(tagOpen)+`<span class="tok-tag">${esc(tagName)}</span>`;
   if(tagAttrs){
    const attrRegex=/([a-zA-Z0-9_:-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;
    let attrOut='',aLast=0,aMatch;
    while((aMatch=attrRegex.exec(tagAttrs))!==null){
     if(aMatch.index>aLast)attrOut+=esc(tagAttrs.slice(aLast,aMatch.index));
     const [,aName,aEq,aVal]=aMatch;
     attrOut+=`<span class="tok-attr">${esc(aName)}</span>`;
     if(aEq)attrOut+=esc(aEq);
     if(aVal)attrOut+=aVal.startsWith('"')||aVal.startsWith("'")?`<span class="tok-str">${esc(aVal)}</span>`:`<span class="tok-val">${esc(aVal)}</span>`;
     aLast=attrRegex.lastIndex;
    }
    if(aLast<tagAttrs.length)attrOut+=esc(tagAttrs.slice(aLast));
    out+=attrOut;
   }
   out+=esc(tagClose);
  }else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightCss(code){
 const regex=/(\/\*[\s\S]*?\*\/)|(@[a-zA-Z-]+)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#[a-fA-F0-9]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\b)|(!important\b)|(\b[a-zA-Z-]+(?=\s*:))|([{}():;,])/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,atRule,str,hex,num,imp,prop,punc]=match;
  if(com)out+=`<span class="tok-com">${esc(com)}</span>`;
  else if(atRule)out+=`<span class="tok-kw">${esc(atRule)}</span>`;
  else if(str)out+=`<span class="tok-str">${esc(str)}</span>`;
  else if(hex)out+=`<span class="tok-color">${esc(hex)}</span>`;
  else if(num)out+=`<span class="tok-num">${esc(num)}</span>`;
  else if(imp)out+=`<span class="tok-kw">${esc(imp)}</span>`;
  else if(prop)out+=`<span class="tok-prop">${esc(prop)}</span>`;
  else if(punc)out+=`<span class="tok-op">${esc(punc)}</span>`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightJs(code){
 const regex=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\`|[\s\S])*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|from|of)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|(\b(?:String|Number|Boolean|Array|Object|Function|Promise|Map|Set|JSON|Math|Date|RegExp|Error|Symbol|document|window|console|localStorage|sessionStorage|fetch|crypto)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:0x[a-fA-F0-9]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b)|(=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||[+\-*\/%&|^!~?:=<>])/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,str,kw,val,type,fn,num,op]=match;
  if(com)out+=`<span class="tok-com">${esc(com)}</span>`;
  else if(str)out+=`<span class="tok-str">${esc(str)}</span>`;
  else if(kw)out+=`<span class="tok-kw">${esc(kw)}</span>`;
  else if(val)out+=`<span class="tok-const">${esc(val)}</span>`;
  else if(type)out+=`<span class="tok-type">${esc(type)}</span>`;
  else if(fn)out+=`<span class="tok-fn">${esc(fn)}</span>`;
  else if(num)out+=`<span class="tok-num">${esc(num)}</span>`;
  else if(op)out+=`<span class="tok-op">${esc(op)}</span>`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightPython(code){
 const regex=/(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|(?:f|r|b)?'(?:\\.|[^'\\])*'|(?:f|r|b)?"(?:\\.|[^"\\])*")|(\b(?:def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|pass|raise|break|continue|lambda|async|await|and|or|not|is|in|global|nonlocal|assert)\b)|(\b(?:True|False|None)\b)|(\b(?:print|len|range|str|int|float|list|dict|set|tuple|open|type|enumerate|zip|isinstance|sum|min|max|any|all|map|filter)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?\b)|([+\-*\/%&|^!~=<>]=?|==|!=|<=|>=)/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,str,kw,val,built,fn,num,op]=match;
  if(com)out+=`<span class="tok-com">${esc(com)}</span>`;
  else if(str)out+=`<span class="tok-str">${esc(str)}</span>`;
  else if(kw)out+=`<span class="tok-kw">${esc(kw)}</span>`;
  else if(val)out+=`<span class="tok-const">${esc(val)}</span>`;
  else if(built)out+=`<span class="tok-type">${esc(built)}</span>`;
  else if(fn)out+=`<span class="tok-fn">${esc(fn)}</span>`;
  else if(num)out+=`<span class="tok-num">${esc(num)}</span>`;
  else if(op)out+=`<span class="tok-op">${esc(op)}</span>`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightJson(code){
 const regex=/("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,key,str,val,num]=match;
  if(key)out+=`<span class="tok-attr">${esc(key)}</span>`;
  else if(str)out+=`<span class="tok-str">${esc(str)}</span>`;
  else if(val)out+=`<span class="tok-const">${esc(val)}</span>`;
  else if(num)out+=`<span class="tok-num">${esc(num)}</span>`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function updateDiagnostics(text,name){
 const diag=$('#editor-diag');
 if(!diag)return;
 if(name.endsWith('.json')){
  try{JSON.parse(text);diag.className='diag-ok';diag.textContent='✓ Valid JSON';}
  catch(e){diag.className='diag-err';diag.textContent='⚠️ '+e.message;}
  return;
 }
 if(name.endsWith('.js')||name.endsWith('.mjs')){
  try{new Function(text);diag.className='diag-ok';diag.textContent='✓ JS syntax OK';}
  catch(e){diag.className='diag-err';diag.textContent='⚠️ '+e.message;}
  return;
 }
 if(name.endsWith('.py')){
  let parens=0,brackets=0,braces=0;
  for(const c of text){if(c==='(')parens++;else if(c===')')parens--;else if(c==='[')brackets++;else if(c===']')brackets--;else if(c==='{')braces++;else if(c==='}')braces--;}
  if(parens!==0||brackets!==0||braces!==0){diag.className='diag-warn';diag.textContent='⚠️ Unmatched brackets';}
  else{diag.className='diag-ok';diag.textContent='✓ Python structure OK';}
  return;
 }
 diag.className='diag-ok';diag.textContent='✓ Source OK';
}
function terminalPanel(){
 const lines=termHistory.map(l=>'<span style="color:'+(l.err?'#f87171':'#86efac')+'">'+esc(l.text)+'</span>').join('\n');
 return '<div class="terminal-panel"><pre id="term-output">'+lines+'</pre><div class="term-input-row"><span>$ </span><input id="term-input" placeholder="Type command (help, ls, cat, check, clear)..." autocomplete="off" autocorrect="off" spellcheck="false"></div></div>';
}
async function runTerminalCommand(cmd){
 cmd=cmd.trim();if(!cmd)return;
 termHistory.push({text:'$ '+cmd,err:false});
 const parts=cmd.split(/\s+/),command=parts[0].toLowerCase(),arg=parts.slice(1).join(' ');
 if(command==='clear'||command==='cls'){termHistory=[];return;}
 if(command==='help'){
  termHistory.push({text:'Available commands:\n  help        - Show this help\n  ls / dir    - List project files\n  cat <file>  - Display file contents\n  check       - Run static checks on current project\n  wc <file>   - Count lines and characters\n  clear       - Clear terminal screen\n  echo <text> - Print text',err:false});
  return;
 }
 if(command==='ls'||command==='dir'){
  const fList=names().map(n=>'  '+n.padEnd(24)+' '+(current().files[n]?.length||0)+' B').join('\n');
  termHistory.push({text:'Project: '+current().name+' ('+names().length+' files)\n'+fList,err:false});
  return;
 }
 if(command==='cat'||command==='type'){
  if(!arg||current().files[arg]===undefined)termHistory.push({text:'File not found: "'+arg+'". Use "ls" to list files.',err:true});
  else termHistory.push({text:current().files[arg],err:false});
  return;
 }
 if(command==='wc'){
  if(!arg||current().files[arg]===undefined)termHistory.push({text:'File not found: "'+arg+'"',err:true});
  else{const content=current().files[arg],lines=content.split('\n').length;termHistory.push({text:'  Lines: '+lines+', Chars: '+content.length+', File: '+arg,err:false});}
  return;
 }
 if(command==='check'){
  termHistory.push({text:'Running static code checks...',err:false});
  try{
   const res=await api('/api/checks','POST',{files:current().files});
   const pass=res.checks.filter(c=>c.status==='pass').length,warn=res.checks.filter(c=>c.status!=='pass').length;
   termHistory.push({text:'Checks complete: '+pass+' passed, '+warn+' warnings.',err:warn>0});
  }catch(err){termHistory.push({text:'Checks failed: '+err.message,err:true});}
  return;
 }
 if(command==='echo'){termHistory.push({text:arg,err:false});return;}
 if(online&&user){
  try{
   const res=await api('/api/terminal/run','POST',{cmd,projectId:current().id});
   termHistory.push({text:res.output||'(No output)',err:res.exitCode!==0});
  }catch(err){termHistory.push({text:'Error: '+err.message,err:true});}
  return;
 }
 termHistory.push({text:'Command not recognized: "'+command+'". Type "help" for a list of commands.',err:true});
}

const jobLabels={'python-file':'Run Python file','python-syntax':'Python syntax','python-test':'Python unittest','python-pytest':'Python pytest','python-run':'Run Python script','node-test':'Node tests','react-build':'React build'};
const isReact=()=>Object.keys(current().files).some(n=>/\.(jsx|tsx)$/.test(n));
const currentBuild=()=>compiled&&compiled.projectId===current().id&&compiled.source===workspaceSource(current().files)?compiled:null;
const current=()=>state.projects.find(p=>p.id===state.active)||state.projects[0];
const names=()=>Object.keys(current().files).sort();
function safeStarter(){return starter();}
async function api(route,method='GET',body){const r=await fetch(route,{method,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(route==='/api/runtime/build'?110000:route==='/api/agent'||route==='/api/deploy/netlify'||route==='/api/inference'?65000:route==='/api/bootstrap'?1500:20000)});if(!r.ok){let data;try{data=await r.json();}catch{}const e=Error(data?.error||`Request failed (${r.status}).`);e.status=r.status;e.reserved=data?.reserved;e.reservationRetained=data?.reservationRetained;e.providerAttempted=data?.providerAttempted;e.upstreamStatus=data?.upstreamStatus;e.code=data?.code;throw e;}return r.json();}
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',6500);}
function modal(title,body,footer='<button class="btn secondary" data-close>Close</button>'){const d=$('#modal');d.innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2><button data-close aria-label="Close">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="modal-actions">${footer}</div>`;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());if(!d.open)d.showModal();}
function capture(){if($('#prompt'))aiDraft=$('#prompt').value;if($('#agent-role'))role=$('#agent-role').value;}
function checkpoint(label){current().checkpoints.unshift({id:id(),label,time:Date.now(),files:{...current().files}});current().checkpoints=current().checkpoints.slice(0,8);}
function activity(type,title,details){state.history.unshift({id:id(),type,title,details,time:Date.now(),project:current().name});state.history=state.history.slice(0,100);save();}
function save(){editSequence++;current().updated=Date.now();try{localStorage.setItem(user?'agentdock.v2.'+user.id:'agentdock.v2.offline',JSON.stringify(state));saveMessage=online&&user?'Saving to laptop...':'Saved in this browser';}catch{saveMessage='Backup needed: browser storage full';}if(online&&user&&!syncBlocked){clearTimeout(saveTimer);saveTimer=setTimeout(()=>flush().catch(e=>toast(e.message)),700);}updateSaved();}
function updateSaved(){if($('#saved-label'))$('#saved-label').textContent=saveMessage;if($('#sync-label'))$('#sync-label').textContent=saveMessage;}
async function flush(){clearTimeout(saveTimer);if(!online||!user)return;if(syncBlocked)throw Error('Save conflict: export a backup and reload the server copy.');if(syncPromise){await syncPromise;return flush();}if(savedSequence===editSequence)return;
 syncPromise=(async()=>{while(savedSequence<editSequence){const sequence=editSequence;const snapshot=JSON.parse(JSON.stringify(state));const result=await api('/api/workspace','PUT',{revision,state:snapshot});revision=result.revision;savedSequence=sequence;}saveMessage='Saved on your laptop';updateSaved();})().catch(e=>{saveMessage=e.status===409?'Save conflict - export a backup':'Server save failed - browser backup kept';if(e.status===409)syncBlocked=true;updateSaved();throw e;}).finally(()=>syncPromise=null);return syncPromise;
}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const nav=[['projects','grid','Projects'],['workspace','code','Workspace'],['components','layers','UI library'],['history','clock','Activity'],['verification','shield','Verification'],['runtime','code','Runtime'],['releases','external','Releases'],['settings','settings','Settings']];
function header(kicker,title,desc,actions=''){return `<div class="page-head"><div><div class="overline">${kicker}</div><h1>${title}</h1><p>${desc}</p></div><div class="head-actions">${actions}</div></div>`;}
function render(){capture();if(!names().includes(file))file='index.html';$('#app').innerHTML=`<aside class="sidebar"><div class="workspace-switch"><div class="avatar">${esc((user?.username||'P')[0].toUpperCase())}</div><div>${esc(user?.username||'Personal workspace')}<small>${online?'Laptop server + SQLite':'Offline browser workspace'}</small></div></div><div class="nav-label">WORKSPACE</div><nav>${nav.map(([key,i,title])=>`<button class="nav-button ${view===key?'active':''}" data-view="${key}" aria-label="${esc(title)}" title="${esc(title)}">${icon(i)}<span>${title}</span>${key==='components'?`<span class="pill">${catalog.length+shared.length+state.components.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="cost-card"><span class="seed">${icon('leaf')} YOUR BUDGET COMES FIRST</span><strong>Local tools. Zero AI tokens.</strong><p>Only an approved AI request can use your model allowance.</p></div><button class="user" data-action="account"><div class="avatar">${user?'U':'+'}</div><div>${esc(user?.username||'Offline mode')}<small>${user?(user.admin?'Instance owner':'Local account'):'Connect to server'}</small></div></button></div><div class="sidebar-resizer" id="sidebar-resizer" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to slide sidebar width (Double-click to reset)" aria-label="Resize transition menu"><div class="sidebar-resizer-line"></div><div class="sidebar-resizer-handle"></div></div></aside><main class="main"><header class="topbar"><button class="btn secondary sidebar-toggle-btn" data-action="toggle-sidebar" title="Toggle Left Sidebar (Ctrl+B)" aria-label="Toggle Sidebar">${icon('sidebar')}</button><div class="brand" data-view="workspace" role="button" tabindex="0" title="AgentDock Workspace" style="cursor:pointer"><span class="brand-mark">${icon('layers')}</span><span>agentdock<span style="color:#8aa173">.</span></span></div><div class="breadcrumbs">Your workspace <span>/</span><strong>${nav.find(n=>n[0]===view)?.[2]}</strong></div><div class="top-actions"><button class="btn secondary cmd-palette-btn" data-action="open-palette" title="Command Palette (Ctrl+K / ⌘K)" aria-label="Command Palette">${icon('search')} <span class="cmd-pill">Ctrl K</span></button><button class="btn secondary theme-toggle-btn" data-action="toggle-theme" title="Switch to ${theme==='dark'?'light':'dark'} mode" aria-label="Toggle theme">${icon(theme==='dark'?'sun':'moon')}</button><span class="status">${status?.connected?esc(status.provider==='azure'?'Azure configured':'AI configured'):'No AI spend'}</span><button class="btn secondary" data-action="help">Quick guide</button><button class="btn primary" data-action="export">Export project</button></div></header><div class="content">${syncBlocked?'<div class="notice">Another tab changed the workspace. Your browser backup is kept. Export a backup in Settings before reloading the server copy.</div>':''}${page()}</div></main>`;bind();if(view==='workspace'&&(tab==='preview'||tab==='split'))updatePreview();}
function page(){if(view==='workspace')return workspace();if(view==='projects')return projectsPage();if(view==='components')return componentsPage();if(view==='history')return historyPage();if(view==='releases')return releasesPage();if(view==='runtime')return runtimePage();if(view==='verification')return header('CHECKS YOU CAN INSPECT.','Verify before you ship.','Evidence for a source snapshot, saved on your laptop.')+verificationMarkup({project:current(),reports:verificationReports,sourceHash:verificationHash,busy:verificationBusy,selectedId:verificationSelected,online:online&&Boolean(user)});return settingsPage();}
function workspace(){return header('YOUR IDEA. YOUR CODE. YOUR RULES.','Build with a little more confidence.','Compose, test, and review. Every change stays yours.',`<button class="btn secondary" data-action="check">Check code</button><button class="btn primary" data-action="new">New project</button>`)+`<div class="summary-strip">${[['CURRENT PROJECT',current().name],['SOURCE FILES',names().length+' files / '+(Object.values(current().files).join('').length/1024).toFixed(1)+' KB'],['CHANGE POLICY','Review before applying'],['DAILY AI RESERVATION',status?`${status.used} / ${status.dailyLimit}`:'0 tokens']].map(([label,value])=>`<div class="summary-item"><div><small>${label}</small><strong>${esc(value)}</strong></div></div>`).join('')}</div><div class="studio-grid ${editorMaximized?'editor-maximized':''}"><div><section class="panel"><div class="panel-title"><span>${esc(current().name)}</span><small id="saved-label">${esc(saveMessage)}</small></div><div class="studio-tabs">${[['preview','monitor','Preview'],['code','code','Code'],['split','layers','Split'],['checks','shield','Checks'],['terminal','code','Terminal']].map(([key,i,label])=>`<button class="tab ${tab===key?'active':''}" data-tab="${key}">${icon(i)}${label}</button>`).join('')}<div class="right"><button class="device-btn ${!mobile?'active':''}" data-device="desktop" aria-label="Desktop preview">${icon('monitor')}</button><button class="device-btn ${mobile?'active':''}" data-device="mobile" aria-label="Mobile preview">${icon('phone')}</button><button class="device-btn" data-action="refresh" aria-label="Refresh preview">${icon('refresh')}</button></div></div>${tab==='checks'?checksPanel():tab==='terminal'?terminalPanel():`<div class="workspace-area ${tab==='split'?'split-mode':''}">${tab==='code'||tab==='split'?editorPanel():''}${tab==='preview'||tab==='split'?previewPanel():''}</div>`}<div class="panel-footer"><span>${icon('code')} ${online?'Snapshot sandbox':'Browser sandbox'} / ${names().length} files</span><button class="text-button" data-action="checkpoints">${icon('clock')} Checkpoints (${current().checkpoints.length})</button></div></section>${runOutputPanel()}<div class="section-heading"><h2>Browser console & functional checks</h2><div class="head-actions" style="margin:0;gap:8px"><button class="text-button" data-action="clear-console">Clear console</button><button class="text-button" data-action="smoke-test">${icon('shield')} Run browser checks</button></div></div><div class="console-filter-bar"><button class="console-filter-btn ${consoleFilter==='all'?'active':''}" data-console-filter="all">All (${logs.length})</button><button class="console-filter-btn ${consoleFilter==='error'?'active':''}" data-console-filter="error">Errors (${logs.filter(l=>l.level==='error').length})</button><button class="console-filter-btn ${consoleFilter==='warn'?'active':''}" data-console-filter="warn">Warnings (${logs.filter(l=>l.level==='warn').length})</button><button class="console-filter-btn ${consoleFilter==='info'?'active':''}" data-console-filter="info">Info (${logs.filter(l=>l.level!=='error'&&l.level!=='warn').length})</button></div><div class="panel console-panel">${renderConsoleContent()}</div><div class="section-heading"><h2>Good pieces to start with</h2><button class="text-button" data-view="components">Explore library ${icon('arrow')}</button></div><div class="component-grid compact">${catalog.slice(0,3).map(componentCard).join('')}</div></div>${assistantPanel()}</div><footer class="bottom-note"><span>Small steps. Real progress.</span><span>Local development edition / v0.2</span></footer>`;}
function editorPanel(){
 ensureOpenTabs();
 const visible=new Set(visibleSourceFiles(current().files,{showAll:showSupportFiles,query:fileQuery}));
 const lineCount=(current().files[file]||'').split('\n').length;
 const sizeKb=((current().files[file]?.length||0)/1024).toFixed(1);
 const ext=file.split('.').pop().toUpperCase();
 return `<div class="code-pane"><div class="file-browser"><div class="file-tree-head">FILES<button data-action="add-file" aria-label="Add file">+</button></div><input id="file-search" aria-label="Find source file" placeholder="Find any file..." value="${esc(fileQuery)}"><label class="file-visibility"><input id="show-support-files" type="checkbox" ${showSupportFiles?'checked':''}>Show all files</label><small id="file-count" class="file-count">${visible.size} of ${names().length} files</small>${names().map(n=>`<button class="tree-file ${file===n?'active':''}" data-file="${esc(n)}" title="${esc(n)}${isSupportFile(n)?' (support file)':''}" ${visible.has(n)?'':'hidden'}><span class="tree-file-dot ${file===n?'active':''}"></span><span>${esc(n)}</span></button>`).join('')}<p id="file-empty" class="file-count" ${visible.size?'hidden':''}>No matching files. Try Show all files.</p><button class="text-button" style="margin:15px 9px" data-action="upload-files">Import files</button></div><div class="editor-wrap"><div class="file-tabs-bar"><div class="file-tabs-scroll">${openTabs.map(t=>`<div class="file-tab-item ${t===file?'active':''}" data-tab-file="${esc(t)}"><span class="file-tab-name">${esc(t)}</span><button class="file-tab-close" data-close-tab="${esc(t)}" title="Close ${esc(t)} (Ctrl+W)" aria-label="Close ${esc(t)}">✕</button></div>`).join('')}<button class="file-tab-add" data-action="add-file" title="New file" aria-label="New file">+</button></div><div class="file-tabs-actions"><button class="text-button editor-bar-action" data-action="format-code" title="Format Code (Alt+Shift+F)">Format</button><button class="text-button editor-bar-action" data-action="open-find" title="Find & Replace (Ctrl+F)">Find</button><button class="text-button editor-bar-action" data-action="download-file" title="Download active file">Download</button>${file!=='index.html'?'<button class="text-button editor-bar-action" data-action="rename-file">Rename</button>':''}${file!=='index.html'?'<button class="text-button editor-bar-action" data-action="delete-file">Remove</button>':''}<button class="text-button editor-bar-action" data-action="toggle-maximize" id="btn-maximize-editor" title="Toggle Fullscreen / Zen Editor (Ctrl+M)">${editorMaximized?'Restore':'Maximize'}</button></div></div><div id="editor-search-bar" class="editor-search-bar" style="display:none"><div class="search-inputs"><div class="search-input-wrap"><input id="editor-find-input" placeholder="Find in ${esc(file)}..." aria-label="Find in file"><span id="editor-find-count" class="find-count">No matches</span><button class="icon-btn" id="find-prev" title="Previous match (Shift+Enter)">↑</button><button class="icon-btn" id="find-next" title="Next match (Enter)">↓</button><button class="icon-btn" id="find-case" title="Match case">Aa</button></div><div class="replace-input-wrap"><input id="editor-replace-input" placeholder="Replace with..." aria-label="Replace with"><button class="btn secondary sm" id="btn-replace" title="Replace current match">Replace</button><button class="btn secondary sm" id="btn-replace-all" title="Replace all matches">Replace All</button></div></div><button class="icon-btn close-search" id="close-search" title="Close (Escape)">✕</button></div><div class="editor-container" data-code-theme="${esc(codeTheme)}"><div id="line-numbers" class="line-numbers">1</div><div class="editor-stage"><pre id="editor-highlight" aria-hidden="true"><code id="highlight-code">${highlightSyntax(current().files[file]||'',file)}</code></pre><textarea id="editor" aria-label="Source code for ${esc(file)}" spellcheck="false" autocapitalize="off">${esc(current().files[file])}</textarea></div></div><div class="editor-status-bar"><div class="editor-bar-left"><span id="editor-diag" class="diag-ok">✓ Clean syntax</span><span id="editor-cursor" class="editor-meta-pill">Ln 1, Col 1</span><span id="editor-selection" class="editor-meta-pill" hidden>0 chars</span></div><div class="editor-bar-right"><select id="code-theme-picker" class="editor-theme-select" title="Syntax Highlighting Theme"><option value="obsidian" ${codeTheme==='obsidian'?'selected':''}>Obsidian Black</option><option value="vs-dark" ${codeTheme==='vs-dark'?'selected':''}>VS Code Dark+</option><option value="monokai" ${codeTheme==='monokai'?'selected':''}>Monokai Pro</option><option value="dracula" ${codeTheme==='dracula'?'selected':''}>Dracula</option><option value="vs-light" ${codeTheme==='vs-light'?'selected':''}>VS Code Light+</option><option value="github-light" ${codeTheme==='github-light'?'selected':''}>GitHub Light</option></select><span id="editor-stats" class="editor-meta-pill">${lineCount} lines • ${sizeKb} KB</span><span class="editor-lang-badge">${esc(ext)}</span><button class="text-button editor-bar-action" id="toggle-wrap-btn" title="Toggle Word Wrap">Wrap: Off</button></div></div></div></div>`;
}
function filterFileList(){const visible=new Set(visibleSourceFiles(current().files,{showAll:showSupportFiles,query:fileQuery}));document.querySelectorAll('[data-file]').forEach(b=>b.hidden=!visible.has(b.dataset.file));if($('#file-count'))$('#file-count').textContent=visible.size+' of '+names().length+' files';if($('#file-empty'))$('#file-empty').hidden=visible.size>0;}
function runOutputPanel(){
 const python=names().some(n=>n.endsWith('.py')),result=matchingJob(buildResult,current().id),running=matchingJob(runningJob,current().id),stale=jobIsStale(result,current().files);
 return `<section class="panel run-output" aria-labelledby="run-output-heading"><div class="panel-title"><span id="run-output-heading">Run & output</span><span class="badge ${result&&!result.ok?'warning':''}" role="status">${running?'Running...':result?(result.ok?'Completed':'Failed'):'Ready'}</span></div><div class="run-toolbar">${python?`<label class="file-visibility run-consent"><input id="workspace-run-consent" type="checkbox">I approve one isolated run of this project.</label><div class="settings-buttons"><button class="btn primary" data-action="python-file" ${buildBusy||!file.endsWith('.py')?'disabled':''}>Run Python file</button><button class="btn secondary" data-action="python-syntax" ${buildBusy?'disabled':''}>Python syntax</button><button class="btn secondary" data-action="python-test" ${buildBusy?'disabled':''}>Python unittest</button></div><p class="tiny-note">Select a .py file in Code, approve, then run. Output appears below when it finishes. Use print(...) to display a value. Interactive input is unavailable; start web servers in Runtime.</p>`:`<button class="btn primary" data-action="run-preview">Run / preview website</button><p class="tiny-note">Website output appears in Preview. JavaScript console.log(...) messages appear in Browser console below. Use Runtime for framework builds and Node tests.</p>`}</div>${running?`<p class="output-meta" role="status">Running ${esc(jobLabels[running.mode]||running.mode)}${running.entry?' / '+esc(running.entry):''} in Docker. Waiting for output...</p>`:''}${result?`<div class="output-meta">${esc(jobLabels[result.mode]||result.mode)}${result.entry?' / '+esc(result.entry):''} / ${esc(new Date(result.completed).toLocaleTimeString())}${Number.isInteger(result.exitCode)?' / exit '+result.exitCode:''}${Number.isFinite(result.durationMs)?' / '+(result.durationMs/1000).toFixed(1)+'s':''} <span id="run-output-stale" class="badge warning" ${stale?'':'hidden'}>Source changed since this run</span></div><pre id="run-output-text" class="run-output-text" tabindex="0" aria-label="Program output">${esc(result.log||(result.ok?'Finished successfully with no printed output. Add print(...) to display a value.':'The job failed without output. Check Runtime diagnostics.'))}</pre>${running?'<div class="stdin-row"><input id="stdin-input" placeholder="Send input to process (stdin)..."/><button class="btn secondary" id="stdin-send">Send</button></div>':''}<div class="output-actions"><button class="text-button" data-action="download-output">Download output</button><button class="text-button" data-action="clear-output" ${buildBusy?'disabled':''}>Clear output</button></div>`:running?'':'<pre class="run-output-text output-placeholder">'+(python?'Your Python output, test results and errors will appear here.':'Open Preview to see your webpage and Browser console for JavaScript output.')+'</pre>'}</section>`;
}
function previewPanel(){return `<div class="preview-pane"><div class="urlbar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><code>isolated snapshot / index.html</code><span id="preview-state" style="margin-left:auto">Starting...</span></div><div class="preview-wrap ${mobile?'mobile':''}"><iframe id="preview" title="Application preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div></div>`;}
function checksPanel(){return `<div class="checks" style="min-height:480px"><div class="notice" style="margin-top:16px">Static checks and functional smoke checks help catch mistakes. They are not a production-readiness or security guarantee.</div>${checks.length?checks.map(c=>`<div class="check"><span class="${c.status}">${icon(c.status==='pass'?'check':'warn')}</span><div>${esc(c.name)} <span class="badge ${c.status==='pass'?'':'warning'}">${c.status==='pass'?'Passed':'Needs attention'}</span><small>${esc(c.status==='pass'?'Passed this check.':c.message||'This check needs attention.')}</small></div></div>`).join(''):'<div class="empty">Run Check code to parse JavaScript and inspect HTML. Run browser checks from the live preview for DOM and interaction checks.</div>'}</div>`;}
function assistantPanel(){return `<aside class="panel assistant"><div class="panel-title"><span>${icon('spark')} Build assistant</span><span class="badge">${status?.connected?'Configured':'AI off'}</span></div><div class="agent-identity"><div class="agent-avatar">${icon('spark')}</div><div><strong>You stay in control.</strong><small>No background requests or agent loops.</small></div></div><div class="agent-body">${aiOutcome?.account===user?.id&&aiOutcome?.projectId===current().id?`<div class="notice ${aiOutcome.ok?'':'runtime-error'}" role="status"><strong>Last model request</strong><br>${esc(aiOutcome.message)}${Number.isSafeInteger(aiOutcome.reserved)?'<br>Token reservation: '+aiOutcome.reserved+(aiOutcome.reservationRetained?' (retained)':''):''}${Number.isSafeInteger(aiOutcome.providerTokens)?'<br>Provider-reported tokens: '+aiOutcome.providerTokens:''}</div>`:''}<div class="agent-note"><strong>Local tools first.</strong><br>UI integration, code checks, browser checks, and exports use <strong>zero LLM tokens.</strong></div><div class="agent-step"><span class="step-number">1</span><div><strong>Make one focused change</strong>Select only the source files AI needs.</div></div><div class="agent-step"><span class="step-number">2</span><div><strong>Inspect the proposal</strong>Review the changed lines before applying.</div></div><div class="agent-step"><span class="step-number">3</span><div><strong>Verify and keep a checkpoint</strong>Run checks. Roll back whenever needed.</div></div><button class="text-button" style="margin-top:16px" data-action="repair">${icon('shield')} Fix missing metadata / 0 tokens</button></div><div class="agent-controls"><textarea id="prompt" placeholder="Describe one focused change..." maxlength="1500" aria-label="AI task">${esc(aiDraft)}</textarea><select id="agent-role" aria-label="Agent role">${[['builder','Builder / code change'],['reviewer','Reviewer / diagnose a failure'],['integrator','Integrator / refine the interface']].map(([v,l])=>`<option value="${v}" ${role===v?'selected':''}>${l}</option>`).join('')}</select><button class="text-button" data-action="context">Context: ${contextFiles?contextFiles.length+' selected files':'all project files'} ${icon('settings')}</button><label><input type="checkbox" id="ai-consent">I approve one request and sending the selected code to my configured provider.</label><button class="btn primary" data-action="ask-ai" ${busy?'disabled':''}>${icon('spark')} ${busy?'Request in progress...':'Request AI proposal'}</button><p class="tiny-note">${status?.connected?`${esc(status.provider==='azure'?'Azure deployment':'Model')}: ${esc(status.model)}. Output cap: ${Math.min(state.settings.outputLimit,status.outputLimit)} tokens.`:'Configure your Azure key locally in .env. Keys never belong in chat or source code.'}</p></div></aside>`;}
function componentArt(c){if(c.id==='stats')return '<div class="mini-metrics">'+['24','08','142'].map(n=>`<div class="mini-metric"><i></i><b>${n}</b><i style="width:45%;margin-top:6px"></i></div>`).join('')+'</div>';if(c.id==='pricing')return '<div class="mini-pricing"><i class="mini-line"></i><b>$12</b><span></span></div>';if(c.id==='faq')return '<div class="mini-faq"><div>Can I take my code with me? +</div><div>Do I need extra libraries? +</div><div>Can I customize the design? +</div></div>';return '<div class="welcome-swatch">'+icon('layers')+'</div>';}
function componentCard(c){return `<article class="component-card"><button class="component-open" data-component="${esc(c.id)}"><div class="component-art ${esc(c.color||'mint')}">${componentArt(c)}</div><div class="component-meta"><div><strong>${esc(c.name)}</strong><small>${esc(c.category)} / ${esc(c.author|| (c.local?'Your library':'Curated'))}</small></div><span class="plus">+</span></div></button>${c.local?`<div class="card-actions"><button class="text-button" data-publish="${esc(c.id)}">Share to this instance</button></div>`:c.shared&&(user?.admin||c.owner===user?.id)?`<div class="card-actions"><button class="text-button" data-unpublish="${esc(c.id)}">Unpublish</button></div>`:''}</article>`;}
function allComponents(){return [...catalog,...state.components,...shared];}
function componentsPage(){return header('A SHARED HEAD START.','Build on good ideas.','Curated components, your personal collection, and this server’s community.',`<button class="btn primary" data-action="add-component">${icon('plus')} Add component</button>`)+`<div class="notice">Community submissions are shared between accounts on this running instance. Nothing is published to the internet automatically. Check the source and license before integrating.</div><div class="searchbar"><input id="component-search" placeholder="Search components..." aria-label="Search components"><select id="category" aria-label="Category"><option>All categories</option><option>Dashboard</option><option>Marketing</option><option>Forms</option><option>Community</option></select><button class="btn secondary" data-action="refresh-community">Refresh</button><button class="btn secondary" data-action="import-components">Import collection</button></div><div class="component-grid catalog-full" id="catalog">${allComponents().map(componentCard).join('')}</div>`;}
function projectsPage(){return header('YOUR NEXT IDEA HAS A HOME.','A space for every possibility.','Source files and checkpoints persist in your local account.',`<button class="btn secondary" data-action="import-project">Import project</button><button class="btn primary" data-action="new">${icon('plus')} New project</button>`)+`<div class="projects-grid">${state.projects.map(p=>`<article class="panel project-card"><div class="welcome-swatch">${icon('folder')}</div><h2>${esc(p.name)}</h2><p>${Object.keys(p.files).length} source files / ${p.checkpoints.length} checkpoints<br>Updated ${new Date(p.updated).toLocaleString()}</p><button class="btn ${p.id===state.active?'primary':'secondary'}" data-project="${p.id}">Open workspace ${icon('arrow')}</button><div class="project-controls"><button class="text-button" data-rename="${p.id}">Rename</button><button class="text-button" data-duplicate="${p.id}">Duplicate</button></div></article>`).join('')}</div>`;}
function historyPage(){const local=state.history.map(h=>({...h,source:'Workspace'})),remote=runs.map(r=>({time:r.created,title:r.kind+' / '+r.status,details:JSON.stringify(r.details),type:r.status,source:'Server'}));const items=[...local,...remote].sort((a,b)=>b.time-a.time).slice(0,150);return header('EVERY STEP, IN VIEW.','Progress you can inspect.','Your local activity plus durable server records. Prompts and keys are not logged.',`<button class="btn secondary" data-action="refresh-runs">Refresh activity</button>`)+`<section class="panel">${items.length?items.map(h=>`<div class="history-item"><span class="summary-icon">${icon(h.type==='applied'?'check':'clock')}</span><div><strong>${esc(h.title)}</strong><p>${new Date(h.time).toLocaleString()} / ${h.source}<br>${esc(h.details)}</p></div><span class="badge">${esc(h.type)}</span></div>`).join(''):'<div class="empty">Checks, agent requests, approvals, and exports will appear here.</div>'}</section>`;}
function releasesPage(){return header('SHARE WHEN YOU ARE READY.','A snapshot worth keeping.','Create immutable local releases, or publish with your configured hosting account.',`<button class="btn secondary" data-action="netlify">Deploy to Netlify</button><button class="btn primary" data-action="release">${icon('plus')} Create local release</button>`)+`<div class="notice">Local releases are served by this laptop only. Their URLs are not internet hosting. Netlify deployment is an explicit external action and requires the instance owner’s server-side credentials.</div><section class="panel">${releases.length?releases.map(r=>`<div class="history-item"><span class="summary-icon">${icon('external')}</span><div><strong>${esc(r.name)}</strong><p>${new Date(r.created).toLocaleString()} / ${r.active?'Available':'Disabled'}</p>${r.active?`<a class="text-button" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open immutable release</a>`:''}</div><button class="btn secondary" style="margin-left:auto" data-release-toggle="${r.id}" data-active="${r.active?'false':'true'}">${r.active?'Disable':'Enable'}</button></div>`).join(''):'<div class="empty">No local releases yet. Create a snapshot of the active project.</div>'}</section>`;}
function settingsPage(){return header('KEEP THE REINS.','Your environment. Your boundaries.','Secure configuration stays on the server; source changes always need your review.')+`<div class="settings-grid"><section class="panel settings-card"><h2>${icon(theme==='dark'?'moon':'sun')} Theme & Appearance</h2><p>Switch between dark and light themes, or adapt to your operating system appearance.</p><div class="toggle-row">Theme mode<div style="display:flex;gap:8px"><button class="btn ${theme==='light'?'primary':'secondary'}" data-theme-set="light">${icon('sun')} Light</button><button class="btn ${theme==='dark'?'primary':'secondary'}" data-theme-set="dark">${icon('moon')} Dark</button><button class="btn secondary" data-theme-set="system">System</button></div></div><div class="toggle-row" style="margin-top:16px">Code editor theme<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ${codeTheme==='obsidian'?'primary':'secondary'}" data-code-theme-set="obsidian">Obsidian Black</button><button class="btn ${codeTheme==='vs-dark'?'primary':'secondary'}" data-code-theme-set="vs-dark">VS Code Dark+</button><button class="btn ${codeTheme==='monokai'?'primary':'secondary'}" data-code-theme-set="monokai">Monokai</button><button class="btn ${codeTheme==='dracula'?'primary':'secondary'}" data-code-theme-set="dracula">Dracula</button><button class="btn ${codeTheme==='vs-light'?'primary':'secondary'}" data-code-theme-set="vs-light">VS Code Light+</button><button class="btn ${codeTheme==='github-light'?'primary':'secondary'}" data-code-theme-set="github-light">GitHub Light</button></div></div></section><section class="panel settings-card"><h2>${icon('leaf')} Token guardrails</h2><p>Server limits cannot be raised from this browser. Reservations include conservative input overhead and the maximum output, including failed or uncertain calls.</p><label class="field">Preferred daily allowance<input id="daily-limit" type="number" min="1000" max="100000" value="${state.settings.dailyLimit}"></label><label class="field">Maximum output per request<input id="output-limit" type="number" min="256" max="4096" value="${state.settings.outputLimit}"></label><div class="toggle-row">Request approval<span class="badge">Always required</span></div><div class="toggle-row">Automatic retries / loops<span class="badge">Off</span></div><div class="toggle-row">Daily reservation<span class="badge">${status?.used||0} tokens</span></div><div class="toggle-row">Monthly reservation<span class="badge">${status?.monthlyUsed||0} / ${status?.monthlyLimit||100000}</span></div><button class="btn primary" data-action="save-settings">Save preferences</button>${user?.admin?`<div class="divider"></div><h2>AI master switch</h2><p>${status?.paused?'All new AI requests are paused. Local tools keep working.':'Requests still require individual approval. Pause here to block all new coding and application-agent requests.'}</p><button class="btn ${status?.paused?'secondary':'danger'}" data-action="toggle-ai" ${status?.pauseLocked?'disabled':''}>${status?.paused?'Resume AI requests':'Pause all AI requests'}</button>${status?.pauseLocked?'<p>AI_PAUSED=1 is locked in server configuration.</p>':''}`:''}<p>This is a token allowance, not a currency-spend guarantee. Also use Azure billing alerts and provider quotas.</p></section><section class="panel settings-card"><h2>${icon('spark')} Model connection</h2><p>${status?.connected?`Configured model: <strong>${esc(status.model)}</strong>. No health check makes a paid request.`:'AI is off. Fill the .env file on your laptop, then restart the server.'}</p><div class="inline-code">OPENAI_MODEL=openai/gpt-4.1-mini\nOPENAI_ENDPOINT=your-exact-base-url\nOPENAI_API_KEY=enter-locally-only</div><p>For hidden key entry and Windows account encryption, run npm run configure:azure in your own terminal. Keys are never returned to this interface. Never paste them into chat or commit them to Git. The .env file is ignored by Git; it is a local plaintext configuration file, not an encrypted vault.</p><button class="btn secondary" data-action="provider-status">Refresh configuration status</button>${user?.admin?'<button class="btn secondary" data-action="provider-diagnostics">Diagnose model connection</button>':''}</section><section class="panel settings-card"><h2>${icon('folder')} Backups & storage</h2><p id="sync-label">${esc(saveMessage)}</p><p>${online?'SQLite stores account workspaces on this laptop.':'Offline mode saves in this browser only.'} A browser recovery copy is also kept. Export backups regularly.</p><div class="settings-buttons"><button class="btn secondary" data-action="backup">Export workspace backup</button><button class="btn secondary" data-action="restore-backup">Restore workspace backup</button><button class="btn secondary" data-action="legacy-import">Import previous browser projects</button><button class="btn secondary" data-action="reload-server">Reload server copy</button></div></section><section class="panel settings-card"><h2>${icon('external')} GitHub & hosting</h2><p>GitHub: ${status?.github?esc(status.githubRepository)+' / '+esc(status.githubBranch):'Not configured'}<br>Netlify: ${status?.netlify?esc(status.netlifySite):'Not configured'}</p><p>Only the instance owner can use server integration credentials. No push or deployment happens automatically.</p><div class="settings-buttons"><button class="btn secondary" data-action="github">Push saved project to GitHub</button><button class="btn secondary" data-action="netlify">Deploy saved project to Netlify</button></div><p>Configure GITHUB_TOKEN, GITHUB_REPOSITORY, NETLIFY_AUTH_TOKEN, and NETLIFY_SITE_ID in your local .env only when you want these integrations.</p></section><section class="panel settings-card"><h2>Implemented runtime</h2><p>Multi-file static websites, accounts, durable workspaces, community components, approvals, snapshots, code checks, browser smoke tests, exports, Azure requests, GitHub commit creation, and Netlify ZIP deployment adapters.</p></section><section class="panel settings-card"><h2>Scope of this local edition</h2><p>The optional Runtime uses a prepared Docker image for React builds and Node tests. It does not install arbitrary project libraries. Temporary Node backends have a separate opt-in and a 15-minute lifetime. Production cloud sandboxes, build workers, hosted multi-user access, payments, password recovery, and managed database services require further infrastructure.</p></section></div>`;}

function bind(){initSidebarResizer();
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{capture();view=b.dataset.view;render();if(view==='components')await refreshCommunity();if(view==='history')await refreshRuns();if(view==='releases')await refreshReleases();if(view==='runtime')await refreshRuntime();if(view==='verification')try{await refreshVerification();}catch(e){toast(e.message);}});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
 document.querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>{mobile=b.dataset.device==='mobile';$('#preview')?.closest('.preview-wrap').classList.toggle('mobile',mobile);});
 document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{file=b.dataset.file;render();});
 document.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>{state.active=b.dataset.project;checks=[];logs=[];contextFiles=null;file='index.html';view='workspace';tab='preview';save();render();});
 document.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>renameProject(b.dataset.rename));
 document.querySelectorAll('[data-duplicate]').forEach(b=>b.onclick=()=>{if(state.projects.length>=20)return toast('Project limit: 20.');const p=state.projects.find(p=>p.id===b.dataset.duplicate);state.projects.push({...p,id:id(),name:(p.name+' copy').slice(0,60),checkpoints:[],files:{...p.files}});save();render();});
 document.querySelectorAll('[data-live-action]').forEach(b=>b.onclick=()=>liveAction(b.dataset.liveAction,b.dataset.liveId).catch(e=>toast(e.message)));
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>Promise.resolve(action(b.dataset.action)).catch(e=>toast(e.message)));
 document.querySelectorAll('[data-console-filter]').forEach(b=>b.onclick=()=>{consoleFilter=b.dataset.consoleFilter;document.querySelectorAll('[data-console-filter]').forEach(el=>el.classList.toggle('active',el===b));const p=$('.console-panel');if(p)p.innerHTML=renderConsoleContent();});
 document.querySelectorAll('[data-code-theme-set]').forEach(b=>b.onclick=()=>{applyCodeTheme(b.dataset.codeThemeSet);render();toast('Code theme: '+b.textContent);});
 document.querySelectorAll('[data-theme-set]').forEach(b=>b.onclick=()=>{const mode=b.dataset.themeSet;if(mode==='system'){const sysDark=(typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);applyTheme(sysDark?'dark':'light');}else{applyTheme(mode);}render();});
 document.querySelectorAll('[data-report-action]').forEach(b=>b.onclick=()=>reportAction(b.dataset.reportAction,b.dataset.reportId).catch(e=>toast(e.message)));
 if($('#file-search'))$('#file-search').oninput=e=>{fileQuery=e.target.value;filterFileList();};
 if($('#show-support-files'))$('#show-support-files').onchange=e=>{showSupportFiles=e.target.checked;filterFileList();};
 bindComponents();
 document.querySelectorAll('[data-release-toggle]').forEach(b=>b.onclick=()=>api('/api/releases/'+b.dataset.releaseToggle+'/toggle','POST',{active:b.dataset.active==='true'}).then(refreshReleases).catch(e=>toast(e.message)));
 if($('#editor')){
  const ed=$('#editor');
  updateLineNumbers();
  updateDiagnostics(ed.value, file);
  ed.onscroll=()=>updateLineNumbers();
  ed.oninput=e=>{
   if(e.target.value.length>150000){toast('File size limit: 150 KB.');return;}
   current().files[file]=e.target.value;
   checks=[];
   save();
   updateLineNumbers();
   updateHighlight();
   updateDiagnostics(e.target.value, file);
   updateCursorInfo();
   if($('#run-output-stale'))$('#run-output-stale').hidden=!jobIsStale(matchingJob(buildResult,current().id),current().files);
   clearTimeout(previewTimer);
   if(tab==='split')previewTimer=setTimeout(updatePreview,700);
  };
  ed.onkeydown=e=>{
   const pairs={'{':'}','[':']','(':')','"':'"',"'":"'",'`':'`'};
   if(pairs[e.key]&&!e.ctrlKey&&!e.metaKey){
    const start=ed.selectionStart,end=ed.selectionEnd;
    if(start===end){
     e.preventDefault();
     ed.setRangeText(e.key+pairs[e.key],start,end,'end');
     ed.selectionStart=ed.selectionEnd=start+1;
     ed.dispatchEvent(new Event('input'));
     return;
    }
   }
   if(e.key==='Tab'){
    e.preventDefault();
    const indent=file.endsWith('.py')?'    ':'  ';
    ed.setRangeText(indent,ed.selectionStart,ed.selectionEnd,'end');
    ed.dispatchEvent(new Event('input'));
    return;
   }
   if((e.ctrlKey||e.metaKey)&&e.key==='s'){
    e.preventDefault();
    flush().then(()=>toast('Saved.')).catch(e=>toast(e.message));
    return;
   }
  };
 }
 if($('#term-input')){$('#term-input').onkeydown=async e=>{if(e.key==='Enter'){const val=e.target.value;e.target.value='';await runTerminalCommand(val);if($('#term-output')){const lines=termHistory.map(l=>'<span style="color:'+(l.err?'#f87171':'#86efac')+'">'+esc(l.text)+'</span>').join('\n');$('#term-output').innerHTML=lines;$('#term-output').scrollTop=$('#term-output').scrollHeight;}}};}
 if($('#stdin-send')){$('#stdin-send').onclick=()=>{const inp=$('#stdin-input');if(!inp||!inp.value.trim())return;const val=inp.value;inp.value='';fetch('/api/runtime/stdin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:runningJob?.sessionId||'',input:val})}).catch(e=>toast(e.message));inp.focus();};if($('#stdin-input'))$('#stdin-input').onkeydown=e=>{if(e.key==='Enter')$('#stdin-send').click();};}
 if($('#prompt'))$('#prompt').oninput=e=>aiDraft=e.target.value;
 if($('#component-search')){const filter=()=>{const q=$('#component-search').value.toLowerCase(),category=$('#category').value;const items=allComponents().filter(c=>(c.name+' '+c.description).toLowerCase().includes(q)&&(category==='All categories'||c.category===category));$('#catalog').innerHTML=items.map(componentCard).join('')||'<div class="empty">No matching components.</div>';bindComponents();};$('#component-search').oninput=filter;$('#category').onchange=filter;}
}
function bindComponents(){document.querySelectorAll('[data-component]').forEach(b=>b.onclick=()=>{const c=allComponents().find(c=>c.id===b.dataset.component);componentDetails(c);});document.querySelectorAll('[data-publish]').forEach(b=>b.onclick=()=>publishComponent(b.dataset.publish));document.querySelectorAll('[data-unpublish]').forEach(b=>b.onclick=()=>api('/api/community/'+b.dataset.unpublish+'/unpublish','POST',{}).then(refreshCommunity).catch(e=>toast(e.message)));}
function componentDetails(c){modal(c.name,`<p>${esc(c.description)}<br>License / attribution: ${esc(c.license||'MIT / AgentDock starter collection')}</p><p>Integration appends HTML before the closing body and adds styles.css. It does not connect backend APIs.</p><div class="diff-columns"><pre>${esc(c.html)}</pre><pre>${esc(c.css)}</pre></div>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="integrate">Review integration</button>');$('#integrate').onclick=()=>{try{propose('Integrate '+c.name,insertComponent(current().files,c),'Local component integration. Inspect placement and behavior before approving.',0);}catch(e){toast(e.message);}};}
async function updatePreview(){if(!$('#preview'))return;const sequence=++previewSequence,originProject=current().id,originFiles=validateFiles({...current().files});previewSourceHash='';previewProjectId='';previewReady=false;logs=[];const consolePanel=$(".console-panel");if(consolePanel)consolePanel.innerHTML='<div class="empty" style="padding:18px">Starting preview...</div>';if(useLivePreview&&await loadLivePreview(sequence))return;const files=currentBuild()?.files||originFiles;if(isReact()&&!currentBuild()){$('#preview').srcdoc='<style>body{font:15px/1.8 system-ui;padding:40px;color:#31543b;background:#f6f8ef}</style><h1>Ready for a React build.</h1><p>Open Runtime, approve an isolated build, then return to Preview.</p>';if($('#preview-state'))$('#preview-state').textContent='Build required';return;}try{if(online&&user){const [result,hash]=await Promise.all([api('/api/preview','POST',{files,artifact:Boolean(currentBuild())}),projectHash(originFiles)]);if(sequence!==previewSequence||!$('#preview'))return;nonce=result.nonce;previewSourceHash=hash;previewProjectId=originProject;$('#preview').src=result.url;}else offlinePreview(files);if($('#preview-state'))$('#preview-state').textContent='Network isolated';}catch(e){if($('#preview-state'))$('#preview-state').textContent='Preview unavailable';toast(e.message);}}
function offlinePreview(files){const doc=new DOMParser().parseFromString(files['index.html'],'text/html');doc.querySelectorAll('base,meta[http-equiv]').forEach(e=>e.remove());for(const link of doc.querySelectorAll('link[rel="stylesheet"]')){const key=(link.getAttribute('href')||'').replace(/^\.\//,'');if(files[key]!==undefined){const style=doc.createElement('style');style.textContent=files[key];link.replaceWith(style);}}for(const script of doc.querySelectorAll('script[src]')){const key=(script.getAttribute('src')||'').replace(/^\.\//,'');if(files[key]!==undefined){script.removeAttribute('src');script.textContent=files[key].replace(/<\/script/gi,'<\\/script');}else script.remove();}const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";doc.head.prepend(csp);$('#preview').srcdoc='<!doctype html>'+doc.documentElement.outerHTML;}
addEventListener('message',e=>{if(!$('#preview')||e.source!==$('#preview').contentWindow)return;if(e.data?.type==='agentdock:inference'){approveInference(e.source,e.data);return;}if(e.data?.agentdock!==nonce)return;const {type,data}=e.data;if(type==='ready'){previewReady=true;if($('#preview-state'))$('#preview-state').textContent='Ready / '+String(data.title).slice(0,50);}if(type==='console')logs.push({level:data.level,text:String(data.text).slice(0,1000)});if(type==='error')logs.push({level:'error',text:String(data).slice(0,1000)});if(type==='tests'){completeBrowserVerification(data).catch(e=>toast(e.message));return;}logs=logs.slice(-100);const panel=$('.console-panel');if(panel&&type!=='tests')panel.innerHTML=logs.slice(-15).map(l=>`<div class="console-line ${l.level==='error'?'console-error':''}"><span>${esc(l.level)}</span>${esc(l.text)}</div>`).join('')||'<div class="empty" style="padding:18px">Preview is ready.</div>';});
function propose(title,next,reason,reserved){next=validateFiles(next);const before={...current().files},projectId=current().id,changes=changedFiles(before,next);if(!changes.length){modal(title,`<p>${esc(reason)}</p><p>No source changes proposed.</p>`);return;}activity('proposed',title,`${changes.length} files / ${reserved||0} reserved tokens`);modal('Review proposed change',`<span class="badge">${reserved?'AI proposal / '+reserved+' reserved tokens':'Local tool / 0 tokens'}</span><p><strong>${esc(title)}</strong><br>${esc(reason)}</p>${changes.map(name=>`<div class="diff-file"><h3>${esc(name)} / before and after</h3><div class="diff-columns"><pre>${esc(before[name]??'[new file]')}</pre><pre>${esc(next[name]??'[removed]')}</pre></div></div>`).join('')}`,'<button class="btn secondary" id="reject">Reject</button><button class="btn primary" id="approve">Approve & apply</button>');$('#reject').onclick=()=>{activity('rejected',title,'No files changed.');$('#modal').close();};$('#approve').onclick=()=>{if(current().id!==projectId||JSON.stringify(current().files)!==JSON.stringify(before)){toast('The project changed. Create a fresh proposal.');$('#modal').close();return;}checkpoint('Before '+title);current().files=next;checks=[];activity('applied',title,'Approved. Previous files saved in a checkpoint.');$('#modal').close();view='workspace';tab='preview';save();render();};}

async function action(a){
if(a==='toggle-sidebar'){sidebarCollapsed=!sidebarCollapsed;applySidebarState();return;}
if(a==='reset-sidebar-width'){applySidebarWidth(220,true);toast('Sidebar reset to default (220px)');return;}
 if(a==='toggle-maximize'){editorMaximized=!editorMaximized;if(typeof document!=='undefined'&&document.body){document.body.classList.toggle('zen-mode',editorMaximized);}render();toast(editorMaximized?'Maximized editor':'Restored layout');return;}
if(a==='open-palette'){openCommandPalette();return;}
 if(a==='format-code'){formatActiveCode();return;}
 if(a==='open-find'){openEditorFind();return;}
 if(a==='clear-console'){logs=[];const p=$('.console-panel');if(p)p.innerHTML='<div class="empty" style="padding:18px">Console cleared.</div>';toast('Console cleared.');return;}
 if(a==='toggle-theme'){applyTheme(theme==='dark'?'light':'dark');render();return;}
 if(a==='run-preview'){view='workspace';tab=tab==='code'?'split':'preview';render();}
 if(a==='python-file')await runBuild(a);
 if(a==='clear-output'){if(!buildBusy){buildResult=null;render();}}
 if(a==='download-output'){const result=matchingJob(buildResult,current().id);if(result)download('run-output.txt',(jobLabels[result.mode]||'Run')+'\n'+(result.entry||'')+'\n'+result.log,'text/plain');}
 if(a==='refresh')await updatePreview();
 if(a==='new')newProject();
 if(a==='runtime-status')await refreshRuntime();
 if(a==='runtime-diagnostics'){const report=await api('/api/runtime/diagnostics');modal('Runtime diagnostics','<p>Read-only local checks. No project execution or AI spend.</p>'+report.checks.map(c=>'<div class="history-item"><div><strong>'+esc(c.name)+' / '+esc(c.status)+'</strong><p>'+esc(c.message)+'</p></div></div>').join(''));}
 if(a==='live-start')await startLiveBackend();
 if(a==='live-refresh')await refreshLive();
 if(a==='static-preview'){useLivePreview=false;view='workspace';tab='preview';render();}
 if(a==='react-build')await runBuild('react-build');
 if(a==='node-test')await runBuild('node-test');
 if(['python-syntax','python-test','python-pytest','python-run'].includes(a))await runBuild(a);
 if(a==='inspect-environment'){const info=await api('/api/runtime/environment','POST',{files:current().files});modal('Project environment','<p>Detected profile: '+esc(info.language)+'</p>'+info.checks.map(c=>'<div class="history-item"><div><strong>'+esc(c.name)+' / '+esc(c.status)+'</strong><p>'+esc(c.message)+'</p></div></div>').join('')+'<h3>Preinstalled Python catalog</h3><p>'+Object.entries(info.pythonCatalog).map(([name,version])=>esc(name)+' '+esc(version)).join(' / ')+'</p>');}
 if(a==='download-file')download(file.split('/').pop(),current().files[file],'text/plain');
 if(a==='rename-file')renameCurrentFile();
 if(a==='build-zip'){if(!currentBuild())throw Error('Build the current source first.');await downloadZip(currentBuild().files,'compiled-website.zip');}
 if(a==='add-file')addFile();
 if(a==='delete-file'){const name=file;modal('Remove source file',`<p>Remove ${esc(name)}? A checkpoint will preserve the current project.</p>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn danger" id="remove-file">Remove file</button>');$('#remove-file').onclick=()=>{checkpoint('Before removing '+name);delete current().files[name];file='index.html';save();$('#modal').close();render();};}
 if(a==='upload-files')uploadFiles();
 if(a==='check'){checks=online&&user?(await api('/api/checks','POST',{files:current().files})).checks:localChecks(current().files);activity('check','Code checks completed',`${checks.filter(c=>c.status==='pass').length}/${checks.length} passed`);tab='checks';view='workspace';render();}
 if(a==='smoke-test')await runSmokeTests();
 if(a==='verify-create')await verifyCurrentSource();
 if(a==='verify-refresh')await refreshVerification();
 if(a==='verify-preview'){view='workspace';tab='preview';render();toast('Wait until the preview is ready, then select Run browser checks.');}
 if(a==='repair'){const next=repairMetadata(current().files);if(!next)toast('Title and viewport are already present.');else propose('Add missing metadata',next,'Deterministic HTML metadata repair. No API call.',0);}
 if(a==='context')chooseContext();
 if(a==='ask-ai')await askAI();
 if(a==='export')exportModal();
 if(a==='backup')download('agentdock-workspace.json',JSON.stringify({kind:'agentdock-workspace',...state},null,2));
 if(a==='restore-backup')importJSON('backup');
 if(a==='import-project')importJSON('project');
 if(a==='import-components')importJSON('components');
 if(a==='add-component')addComponent();
 if(a==='refresh-community')await refreshCommunity();
 if(a==='refresh-runs')await refreshRuns();
 if(a==='checkpoints')showCheckpoints();
 if(a==='release')releaseModal();
 if(a==='netlify')externalModal('netlify');
 if(a==='github')externalModal('github');
 if(a==='account'){if(verificationBusy||pendingBrowserReport)throw Error('Wait for verification to finish before changing accounts.');if(busy||buildBusy||liveBusy||inferencePending)throw Error('Wait for active tasks to finish before changing accounts.');if(user){modal('Local account',`<p>Signed in as <strong>${esc(user.username)}</strong>.</p><p>API keys remain in server configuration. Signing out clears this browser’s active session.</p>`,'<button class="btn secondary" data-close>Close</button><button class="btn danger" id="sign-out">Sign out</button>');$('#sign-out').onclick=async()=>{try{await flush();await api('/api/auth/logout','POST',{});user=null;$('#modal').close();authScreen(false);}catch(e){toast(e.message);}};}else if(online)authScreen(false);else toast('Run the local server to create an account.');}
 if(a==='toggle-ai'){if(!user?.admin)throw Error('Only the instance owner can change this setting.');await api('/api/owner/ai-pause','POST',{paused:!status?.paused});await refreshStatus();render();toast(status?.paused?'New AI requests are paused. In-flight calls may still complete.':'AI requests resumed; each request still needs approval.');}
 if(a==='provider-diagnostics'){const report=await api('/api/provider/diagnostics');modal('Provider diagnostics','<p>No model request was made. Host: '+esc(report.endpointHost||'unavailable')+' / Adapter: '+esc(report.provider)+' / Authentication: '+esc(report.authentication||'unavailable')+'</p>'+report.checks.map(c=>'<div class="history-item"><div><strong>'+esc(c.name)+' / '+esc(c.status)+'</strong><p>'+esc(c.message)+'</p></div></div>').join(''));}
 if(a==='provider-status'){await refreshStatus();render();toast(status?.connected?'Provider configuration detected. No live request made.':'No complete provider configuration found.');}
 if(a==='save-settings'){const daily=Number($('#daily-limit').value),out=Number($('#output-limit').value);if(!Number.isInteger(daily)||daily<1000||daily>100000||!Number.isInteger(out)||out<256||out>4096)throw Error('Use a daily allowance of 1,000-100,000 and output cap of 256-4,096.');state.settings={dailyLimit:daily,outputLimit:out};save();toast('Preferences saved. Server limits remain the ceiling.');}
 if(a==='reload-server'){if(!online||!user)throw Error('No server account connected.');download('before-reload-backup.json',JSON.stringify({kind:'agentdock-workspace',...state},null,2));const result=await api('/api/workspace');if(result.state){state=validateWorkspace(result.state);revision=result.revision;syncBlocked=false;savedSequence=editSequence;saveMessage='Loaded server copy';render();toast('Server copy loaded. Your previous copy was downloaded as a backup.');}}
 if(a==='legacy-import'){const old=localStorage.getItem('agentdock.v1');if(!old)throw Error('No previous browser workspace found on this origin.');mergeWorkspace(validateWorkspace(JSON.parse(old)));toast('Previous projects imported.');}
 if(a==='help')modal('Build, verify, and take it with you',`<p><strong>1. Open Code or Split.</strong> Edit files, add paths such as components/card.js, or import source files.</p><p><strong>2. Use UI library.</strong> Read the component source and license, then review and approve integration.</p><p><strong>3. Run checks.</strong> Check code parses JavaScript without executing it. Browser checks exercise selectors and clicks in the network-isolated preview.</p><p><strong>4. Ask AI only when needed.</strong> Choose context files, approve one provider request, then review the proposal. No automatic paid retry.</p><p><strong>5. Export or release.</strong> Download ZIP, save source into a folder on your laptop, create an immutable local release, or explicitly push/deploy with configured accounts.</p><div class="notice">This edition executes static browser applications only. It does not run arbitrary Node/Python backends or framework builds.</div>`);
}
function newProject(){modal('A new place to build',`<label class="field">Project name<input id="new-name" maxlength="60" placeholder="My next idea"></label><label class="field">Starting point<select id="new-template" aria-label="Starting point"><option value="starter">Landing page starter</option><option value="blank">Blank web application</option><option value="dashboard">Dashboard starter</option><option value="assistant">AI assistant / Azure-ready</option><option value="react">React + Node / container build</option><option value="python">Python / standard library web</option><option value="flask">Python / Flask web API</option><option value="fastapi">Python / FastAPI web API</option><option value="react-python">React + Python Flask</option><option value="python-script">Python / script and CSV utility</option><option value="python-notebook">Python / ML & data science notebook</option></select></label>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="create-project">Create project</button>');$('#create-project').onclick=()=>{const name=$('#new-name').value.trim();if(!name)return toast('Give the project a name.');if(state.projects.length>=20)return toast('Project limit: 20.');let files=safeStarter();if($('#new-template').value==='blank')files={'index.html':'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My app</title><link rel="stylesheet" href="styles.css"></head><body><h1>Hello, builder.</h1><script src="app.js"></script></body></html>','styles.css':'body { font-family: system-ui; padding: 3rem; background: #f6f8f1; color: #244d3f; }','app.js':'console.log("Ready to build.");'};if($('#new-template').value==='dashboard')files=insertComponent(files,catalog[0]);if($('#new-template').value==='assistant')files=assistantTemplate();if($('#new-template').value==='react')files=reactTemplate();if($('#new-template').value==='python')files=pythonTemplate();if(['flask','fastapi'].includes($('#new-template').value))files=pythonTemplate($('#new-template').value);if($('#new-template').value==='react-python')files=reactPythonTemplate();if($('#new-template').value==='python-script')files=pythonTemplate('script');files['agentdock.tests.json'] ||=JSON.stringify({steps:[{action:'exists',selector:'h1'}]},null,2);const p={id:id(),name,files,updated:Date.now(),checkpoints:[]};state.projects.push(p);state.active=p.id;checks=[];logs=[];file='index.html';contextFiles=null;view='workspace';tab='preview';save();$('#modal').close();render();};}
function renameProject(key){const p=state.projects.find(p=>p.id===key);modal('Rename project',`<label class="field">Project name<input id="project-name" value="${esc(p.name)}" maxlength="60"></label>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="rename-project">Save name</button>');$('#rename-project').onclick=()=>{const name=$('#project-name').value.trim();if(!name)return;p.name=name;save();$('#modal').close();render();};}
function addFile(){modal('Add a source file',`<p>Use a relative path, such as components/card.js or pages/about.html. Text source files only, up to 80 files per project.</p><label class="field">File path<input id="file-name" maxlength="160" placeholder="components/card.js"></label>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="create-file">Add file</button>');$('#create-file').onclick=()=>{try{const name=validatePath($('#file-name').value.trim());if(name in current().files)throw Error('That file already exists.');const next=validateFiles({...current().files,[name]:''});checkpoint('Before adding '+name);current().files=next;file=name;save();$('#modal').close();tab='code';render();}catch(e){toast(e.message);}};}
function uploadFiles(){const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.html,.css,.js,.mjs,.json,.svg,.txt,.md,.ts,.tsx,.jsx,.py,.toml,.yaml,.yml,.sql,.csv,.ini';input.onchange=async()=>{try{const next={...current().files};for(const f of input.files){if(f.size>150000)throw Error('File too large: '+f.name);next[validatePath(f.webkitRelativePath||f.name)]=await f.text();}propose('Import source files',validateFiles(next),'Source import may replace files with matching paths. Review before applying.',0);}catch(e){toast(e.message);}};input.click();}
function chooseContext(){modal('Select AI context',`<p>Only selected source files are sent. index.html is always included. Maximum 12,000 source characters. Do not include secrets.</p>${names().map(n=>`<label class="context-option"><input type="checkbox" value="${esc(n)}" ${(!contextFiles||contextFiles.includes(n)||n==='index.html')?'checked':''} ${n==='index.html'?'disabled':''}>${esc(n)} <small>${current().files[n].length} characters</small></label>`).join('')}`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="save-context">Use selected files</button>');$('#save-context').onclick=()=>{contextFiles=[...$('#modal').querySelectorAll('input:checked')].map(e=>e.value);$('#modal').close();render();};}
async function askAI(){
 if(busy)return;if(status?.paused)throw Error('AI requests are paused by the instance owner.');if(!status?.connected)throw Error('Configure your provider credentials locally and restart the server first.');if(!$('#ai-consent').checked)throw Error('Approve one API request using the checkbox.');capture();if(!aiDraft.trim())throw Error('Describe a focused change.');
 const before={...current().files},projectId=current().id,account=user?.id;busy=true;aiOutcome=null;render();
 try{
  const result=await api('/api/agent','POST',{files:before,prompt:aiDraft,role,confirm:true,context:contextFiles||names(),dailyLimit:state.settings.dailyLimit,outputLimit:state.settings.outputLimit});
  if(user?.id!==account)return;
  if(current().id!==projectId||JSON.stringify(current().files)!==JSON.stringify(before))throw Error('Source changed during the request. Response discarded; usage reservation is retained.');
  aiOutcome={account,projectId,ok:true,message:result.cached?'Cached proposal; no new provider request.':'Proposal received. Review it before applying.',reserved:result.reserved,providerTokens:result.providerTokens,cached:Boolean(result.cached)};
  propose(result.title,validateFiles({...before,...result.files}),result.summary,result.reserved);
 }catch(e){
  if(user?.id===account){aiOutcome={account,projectId,ok:false,message:e.message,reserved:e.reserved,reservationRetained:e.reservationRetained,providerAttempted:e.providerAttempted};if(current().id===projectId)activity('error','AI request ended',e.message);toast(e.message);}
 }finally{busy=false;if(user?.id===account)await refreshStatus();render();}
}
function showCheckpoints(){const p=current();modal('Restore a checkpoint',`<p>Restoring saves the current source as another checkpoint.</p>${p.checkpoints.length?p.checkpoints.map(c=>`<div class="history-item"><div><strong>${esc(c.label)}</strong><p>${new Date(c.time).toLocaleString()}</p></div><button class="btn secondary" data-restore="${esc(c.id)}">Restore</button></div>`).join(''):'<p>No checkpoints yet. Approving changes creates one.</p>'}`);document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const c=p.checkpoints.find(c=>c.id===b.dataset.restore);checkpoint('Before restore');p.files={...c.files};checks=[];activity('restored','Checkpoint restored',c.label);save();$('#modal').close();render();});}
function approveInference(frame,message){
 const respond=data=>frame.postMessage({type:'agentdock:inference-result',requestId:message.requestId,...data},'*');
 if(inferencePending)return respond({error:'Another application request is awaiting approval.'});
 if(status?.paused)return respond({error:'AI requests are paused by the instance owner.'});if(!online||!user||!status?.connected)return respond({error:'Configure Azure on the local Studio server before running this agent.'});
 if(typeof message.requestId!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(message.requestId)||typeof message.input!=='string'||message.input.length>1500)return respond({error:'Invalid application request.'});
 let config;try{config=JSON.parse(current().files['agent.config.json']||'{}');if(typeof config.instructions!=='string'||config.instructions.length>4000)throw Error('Edit agent.config.json to provide instructions up to 4,000 characters.');}catch(e){return respond({error:e.message});}
 inferencePending=true;let approved=false;
 const output=Math.min(Number(config.outputTokens)||512,state.settings.outputLimit,status.outputLimit);
 modal('Approve one application-agent request',`<span class="badge">${esc(status.provider)} / ${esc(status.model)}</span><p>The preview wants one live response. Output cap: ${output} tokens. Your daily allowance still applies.</p><h3>Agent instructions</h3><pre class="inline-code">${esc(config.instructions)}</pre><h3>Input sent to your provider</h3><pre class="inline-code">${esc(message.input)}</pre><label class="context-option"><input type="checkbox" id="inference-consent">I approve this one request and the content shown above.</label>`,'<button class="btn secondary" data-close>Reject</button><button class="btn primary" id="approve-inference">Approve request</button>');
 $('#modal').addEventListener('close',()=>{if(!approved){inferencePending=false;respond({error:'Request was not approved. No tokens used.'});}},{once:true});
 $('#approve-inference').onclick=async()=>{if(!$('#inference-consent').checked)return toast('Approve sending the displayed input first.');approved=true;const button=$('#approve-inference');button.disabled=true;try{const result=await api('/api/inference','POST',{input:message.input,instructions:config.instructions,confirm:true,outputLimit:output,dailyLimit:state.settings.dailyLimit});respond({text:result.text});activity('inference','Application agent responded',result.reserved+' tokens reserved');$('#modal').close();await refreshStatus();}catch(e){respond({error:e.message+' No automatic retry.'});$('#modal').close();toast(e.message);}finally{inferencePending=false;}};
}
function exportModal(){modal('Your code goes with you',`<p>Download source or write it directly into an export folder on this laptop.</p><div class="export-options"><button class="btn secondary" id="export-zip">Download ZIP / all files</button><button class="btn secondary" id="export-folder">Save folder on laptop</button><button class="btn secondary" id="export-json">Project bundle / JSON</button><button class="btn secondary" id="export-components">Your component collection</button></div><p id="export-result"></p><p>ZIPs contain source files, not compiled framework builds. Static projects can be hosted as-is.</p>`);$('#export-json').onclick=()=>download('agentdock-project.json',JSON.stringify({version:2,name:current().name,files:current().files},null,2));$('#export-components').onclick=()=>download('agentdock-components.json',JSON.stringify({components:state.components},null,2));$('#export-zip').onclick=async()=>{try{if(!online||!user)throw Error('ZIP export requires the local server. Use the JSON project bundle offline.');const r=await fetch('/api/zip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:current().files})});if(!r.ok)throw Error('ZIP export failed.');download('agentdock-project.zip',await r.blob(),'application/zip');activity('export','ZIP downloaded',names().length+' source files');}catch(e){toast(e.message);}};$('#export-folder').onclick=async()=>{try{const result=await api('/api/export-folder','POST',{files:current().files});$('#export-result').textContent='Saved on your laptop: '+result.path;activity('export','Source saved to laptop',result.path);}catch(e){toast(e.message);}};}
function importJSON(kind){const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{if(!input.files[0])return;if(input.files[0].size>12000000)throw Error('JSON import limit: 12 MB.');const data=JSON.parse(await input.files[0].text());if(kind==='backup'){const restored=validateWorkspace(data);modal('Restore workspace backup',`<p>Merge ${restored.projects.length} projects into your current workspace? Existing projects stay. Imported projects receive new IDs.</p>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="confirm-restore">Merge backup</button>');$('#confirm-restore').onclick=()=>{try{mergeWorkspace(restored);$('#modal').close();toast('Backup merged.');}catch(e){toast(e.message);}};}else if(kind==='components'){if(!Array.isArray(data.components))throw Error('Collection must contain components.');const cs=data.components.map(validateComponent);if(cs.length+state.components.length>30)throw Error('Personal library limit: 30.');state.components.push(...cs.map(c=>({...c,id:id()})));save();render();toast('Components imported.');}else{const files=validateFiles(data.files);if(state.projects.length>=20)throw Error('Project limit: 20.');const p={id:id(),name:String(data.name||'Imported project').slice(0,60),files,updated:Date.now(),checkpoints:[]};state.projects.push(p);state.active=p.id;save();view='workspace';tab='preview';contextFiles=null;render();toast('Project imported.');}}catch(e){toast(e.message);}};input.click();}
function mergeWorkspace(restored){if(state.projects.length+restored.projects.length>20)throw Error('Merged workspace would exceed 20 projects.');state.projects.push(...restored.projects.map(p=>({...p,id:id(),checkpoints:[]})));state.components.push(...restored.components.slice(0,30-state.components.length).map(c=>({...c,id:id()})));save();render();}
function addComponent(){modal('Add to your personal collection',`<label class="field">Component name<input id="component-name" maxlength="60"></label><label class="field">HTML<textarea id="component-html" rows="5" maxlength="20000"></textarea></label><label class="field">CSS<textarea id="component-css" rows="4" maxlength="20000"></textarea></label><label class="field">License and attribution<input id="component-license" maxlength="120" placeholder="MIT / Your name"></label><p>This saves privately. Sharing with other accounts is a separate action.</p>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="save-component">Save component</button>');$('#save-component').onclick=()=>{try{if(state.components.length>=30)throw Error('Personal library limit: 30.');const c=validateComponent({id:id(),name:$('#component-name').value.trim(),html:$('#component-html').value,css:$('#component-css').value,license:$('#component-license').value.trim(),category:'Community'});state.components.push(c);save();$('#modal').close();render();}catch(e){toast(e.message);}};}
function publishComponent(key){const c=state.components.find(c=>c.id===key);modal('Share this component',`<p>Share <strong>${esc(c.name)}</strong> with accounts on this instance under <strong>${esc(c.license)}</strong>?</p><p>Only the HTML, CSS, name, and attribution are shared. Other project files remain private.</p><label class="context-option"><input type="checkbox" id="rights">I own this component or have the right to distribute it under this license.</label>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="publish-component">Share component</button>');$('#publish-component').onclick=async()=>{try{if(!$('#rights').checked)throw Error('Confirm distribution rights first.');await api('/api/community','POST',{component:c,confirm:true});$('#modal').close();await refreshCommunity();toast('Shared with this instance.');}catch(e){toast(e.message);}};}
function releaseModal(){if(isReact()&&!currentBuild())throw Error('Build this React project before creating a release.');modal('Create an immutable local release',`<p>Save a fixed snapshot of <strong>${esc(current().name)}</strong>. It will have a URL on this laptop, independent of future edits.</p><p>This does not publish your application to the internet.</p>`,'<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="create-release">Create local release</button>');$('#create-release').onclick=async()=>{try{const r=await api('/api/releases','POST',{files:currentBuild()?.files||current().files,artifact:Boolean(currentBuild()),name:current().name,confirm:true});activity('release','Local release created',r.url);$('#modal').close();view='releases';await refreshReleases();}catch(e){toast(e.message);}};}
function externalModal(kind){if(kind==='netlify'&&isReact()&&!currentBuild())throw Error('Build the React project before deploying compiled files.');const github=kind==='github',available=github?status?.github:status?.netlify;const target=github?status?.githubRepository:status?.netlifySite;modal(github?'Push to GitHub':'Publish to Netlify',`<p>${available?`Target: <strong>${esc(target)}</strong>`:'This integration is not configured. Add its credentials locally to .env and restart. Only the instance owner can use it.'}</p><p>${github?'This writes the saved source files as a commit to the configured repository branch. Existing files with matching paths are updated. Other repository files are kept. No force push is used.':'This uploads all saved static source files to the configured Netlify site. It may update a live website and use your hosting allowance. Framework source will not be compiled.'}</p>${available?'<label class="context-option"><input id="external-consent" type="checkbox">I approve uploading this project to the target shown above.</label>':''}`,'<button class="btn secondary" data-close>Cancel</button>'+ (available?'<button class="btn primary" id="external-go">'+(github?'Push source commit':'Publish static website')+'</button>':''));if(!available)return;$('#external-go').onclick=async()=>{const button=$('#external-go');try{if(!$('#external-consent').checked)throw Error('Approve the exact target first.');button.disabled=true;await flush();const result=await api(github?'/api/github/push':'/api/deploy/netlify','POST',{projectId:current().id,confirm:true,...(github?{repository:target}:{site:target,files:currentBuild()?.files})});modal(github?'Commit pushed':'Deployment submitted',`<p>${esc(JSON.stringify(result))}</p>${result.url&&/^https:\/\//.test(result.url)?`<a href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">Open result</a>`:''}<p>${github?'':'Submitted does not necessarily mean ready. Check the returned deployment in Netlify.'}</p>`);activity('integration',github?'GitHub commit pushed':'Netlify deployment submitted',JSON.stringify(result));}catch(e){if(button)button.disabled=false;toast(e.message);}};}
async function refreshStatus(){if(!online||!user)return;try{status=await api('/api/status');}catch(e){toast(e.message);}}
async function refreshCommunity(){if(!online||!user)return;try{shared=(await api('/api/community')).components;if(view==='components')render();}catch(e){toast(e.message);}}
async function refreshRuns(){if(!online||!user)return;try{runs=(await api('/api/runs')).runs;if(view==='history')render();}catch(e){toast(e.message);}}
async function refreshReleases(){if(!online||!user){render();return;}try{releases=(await api('/api/releases')).releases;if(view==='releases')render();}catch(e){toast(e.message);}}

function authScreen(setup,register=setup){$('#app').innerHTML=`<main class="auth-shell"><section class="auth-intro"><div class="brand"><span class="brand-mark">${icon('layers')}</span><span>agentdock.</span></div><div><div class="overline">A HOME FOR YOUR NEXT IDEA</div><h1>Build thoughtfully.<br>Keep the controls.</h1><p>A coding workspace with local tools, reviewable AI changes, and a budget that stays yours.</p><div class="auth-feature">${icon('shield')} Your projects stay in your local account.</div><div class="auth-feature">${icon('leaf')} No model call without your approval.</div><div class="auth-feature">${icon('download')} Take your code wherever you go.</div></div><small>Local development edition / no cloud accounts required</small></section><section class="auth-form-wrap"><form id="auth-form" class="auth-form"><span class="badge">ON YOUR LAPTOP</span><h2>${register?'Create a local account.':'Welcome back.'}</h2><p>${setup?'The first account owns this local instance. Use a unique password, not an Azure credential.':'Sign in to load your saved workspace. This account belongs to this server, not Microsoft or OpenAI.'}</p><label class="field">Username<input id="username" name="username" required minlength="3" maxlength="32" autocomplete="username" pattern="[a-zA-Z0-9_-]+"></label><label class="field">Password<input id="password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register?'new-password':'current-password'}"><small>At least 12 characters. Never use your API key as a password.</small></label>${register&&!setup?'<label class="field">Invitation code<input id="invite-code" type="password" autocomplete="off"><small>Ask the instance owner for a beta invitation.</small></label>':''}<button class="btn primary" id="auth-submit" type="submit">${register?'Create local account':'Sign in'} ${icon('arrow')}</button><p id="auth-error" role="alert"></p><button class="text-button" type="button" id="auth-switch">${register?'Already have an account? Sign in':'Create a local account'}</button><div class="divider"></div><button class="text-button" type="button" id="offline-start">Try the browser-only workspace</button></form></section></main>`;$('#auth-switch').onclick=()=>authScreen(setup,!register);$('#offline-start').onclick=()=>startOffline();$('#auth-form').onsubmit=async e=>{e.preventDefault();const submit=$('#auth-submit');submit.disabled=true;try{const data=await api(register?'/api/auth/register':'/api/auth/login','POST',{username:$('#username').value,password:$('#password').value,inviteCode:$('#invite-code')?.value||''});$('#password').value='';user=data.user;await loadAccount();}catch(error){$('#auth-error').textContent=error.message;submit.disabled=false;}};}
function buildRuntimePage(){const result=matchingJob(buildResult,current().id);return header('REACT + NODE + PYTHON / PRIVATE BETA.','Build in a separate environment.','Curated dependencies, isolated jobs, and explicit execution approval.',`<button class="btn secondary" data-action="runtime-status">Check runtime</button><button class="btn secondary" data-action="runtime-diagnostics">Diagnose runtime</button>`)+`<div class="notice">Docker execution is ${runtimeState?.enabled===true?'enabled':runtimeState?.enabled===false?'disabled':'unavailable'}. ${esc(runtimeState?.message||'Prepare the trusted image once, then enable builds in local configuration.')} Temporary Node backends require a separate runtime opt-in and a rebuilt trusted image. Backend state expires after 15 minutes.</div><div class="settings-grid"><section class="panel settings-card"><h2>Trusted build environment</h2><p>React 19.3.1 / Vite 8.3.5 / Node 24 / Python 3.11+. Builds use preinstalled image dependencies; no project npm install or lifecycle scripts are run.</p><div class="inline-code"># Start Docker Desktop yourself\nnpm run sandbox:prepare\n# Then set in .env and restart:\nAGENTDOCK_ENABLE_BUILDS=1</div><p>Preparing the image downloads Node and pinned packages once. Per-project jobs have no network access, use a read-only root and source mount, and have bounded RAM, CPU, process count, temporary disk, output, and time.</p><p>Image: ${esc(runtimeState?.image||'agentdock-builder:local')}<br>Only invited, trusted beta testers should use this local runner. It is not a reviewed public hostile-code hosting service.</p></section><section class="panel settings-card"><h2>Run the current project</h2><p>${esc(current().name)} / ${names().length} source files</p><label class="context-option"><input type="checkbox" id="container-consent">I approve running this project inside the local isolated container.</label><div class="settings-buttons" style="margin-top:18px"><button class="btn primary" data-action="react-build" ${buildBusy?'disabled':''}>${buildBusy?'Job running...':'Build React & preview'}</button><button class="btn secondary" data-action="node-test" ${buildBusy?'disabled':''}>Run Node tests</button><button class="btn secondary" data-action="build-zip" ${currentBuild()?'':'disabled'}>Download compiled ZIP</button></div><p>No LLM tokens are used. Build result is kept in memory; create a local release or download a compiled ZIP to preserve it. Source changes invalidate the compiled preview.</p></section></div><div class="section-heading"><h2>Build / test output</h2></div><section class="panel"><pre class="inline-code" style="margin:0;max-height:400px;overflow:auto">${esc(result?result.log:'No job yet. Create a React + Node project, then build or test it here.')}</pre></section>`;}
async function refreshRuntime(){
 if(!online||!user){runtimeState={enabled:false,ready:false,message:'Start the local server and sign in.'};render();return;}
 try{runtimeState=await api('/api/runtime/status');}catch{runtimeState={enabled:null,ready:false,message:'Runtime status is unavailable. Keep npm start running, then retry Check runtime.'};}
 try{await refreshLive(false);if(liveError==='Backend session status is unavailable. Keep npm start running, then refresh status.')liveError='';}
 catch{liveError='Backend session status is unavailable. Keep npm start running, then refresh status.';}
 if(view==='runtime')render();
}
async function runBuild(mode){
 if(buildBusy)return;if(!online||!user)throw Error('Start the local server and sign in to run code.');
 const consent=$('#workspace-run-consent')||$(mode.startsWith('python-')?'#python-consent':'#container-consent');
 if(!consent?.checked)throw Error('Tick the execution approval checkbox before running code.');
 const files=validateFiles({...current().files}),source=workspaceSource(files),projectId=current().id,account=user.id,entry=mode==='python-file'?file:undefined;
 if(entry&&(!entry.endsWith('.py')||!Object.hasOwn(files,entry)))throw Error('Select an existing .py file in Code.');
 consent.checked=false;buildBusy=true;runningJob={projectId,source,mode,entry};render();
 try{
  const result=await api('/api/runtime/build','POST',{files,confirm:true,mode,...(entry?{entry}:{})});
  if(user?.id!==account)return;
  buildResult={...result,projectId,source,mode,entry:result.entry||entry,completed:Date.now()};
  if(current().id===projectId)activity('container',mode+(result.ok?' passed':' failed'),result.log.slice(-400));
  if(result.ok&&result.files){if(current().id!==projectId||workspaceSource(current().files)!==source)throw Error('Source changed during the build. Build result was not applied.');compiled={projectId,source,files:result.files};view='workspace';tab='preview';toast('Compiled application is ready to preview.');}
  else toast(result.ok?'Job completed. See Run & output.':'Job failed. See Run & output.');
 }catch(e){if(user?.id===account){const message=mode==='python-file'&&/Unsupported sandbox job/.test(e.message)?'Restart Studio (Ctrl+C, then npm start) to enable Run Python file, then refresh this page.':e.message;buildResult={ok:false,mode,entry,projectId,source,completed:Date.now(),log:message};toast(message);}}
 finally{buildBusy=false;runningJob=null;render();}
}
async function downloadZip(files,name){const response=await fetch('/api/zip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files,artifact:true})});if(!response.ok)throw Error('ZIP download failed.');download(name,await response.blob(),'application/zip');}
function runtimePage(){return buildRuntimePage()+pythonEnvironmentPanel()+`<div class="section-heading"><h2>Live Node and Python backends</h2><button class="text-button" data-action="live-refresh">Refresh status</button></div><section class="panel settings-card">${liveError?'<div class="notice runtime-error" role="alert">'+esc(liveError)+'</div>':''}<p>${liveEnabled?'Live runtime is enabled.':'Live runtime is disabled. Rebuild the trusted image, set AGENTDOCK_ENABLE_SERVERS=1 in local configuration, then restart.'} Sessions use no published ports and no external network; Studio forwards bounded HTTP requests through a broker. Platform keys and account cookies are never forwarded.</p><label class="context-option"><input id="live-consent" type="checkbox">I approve a temporary server snapshot. Its in-memory data is discarded when it stops or expires.</label><div class="settings-buttons" style="margin-top:15px"><button class="btn primary" data-action="live-start" ${!liveEnabled||liveBusy||liveSessions.length?'disabled':''}>${liveBusy?'Starting backend...':'Start current backend'}</button><button class="btn secondary" data-action="static-preview">Use static preview</button></div><p>One server per account, two per instance, maximum 15 minutes. Configure entry, internal port, and optional React compilation in agentdock.runtime.json. Source edits require a new server snapshot.</p>${liveSessions.map(s=>`<div class="history-item"><div><strong>${esc(s.state)}</strong><p>Expires ${new Date(s.expires).toLocaleTimeString()}${s.error?'<br>'+esc(s.error):''}</p><div class="settings-buttons"><button class="btn secondary" data-live-action="open" data-live-id="${s.id}" ${s.state==='running'?'':'disabled'}>Open backend preview</button><button class="btn secondary" data-live-action="logs" data-live-id="${s.id}">View logs</button><button class="btn danger" data-live-action="stop" data-live-id="${s.id}">Stop backend</button></div></div></div>`).join('')}</section>`;}
async function refreshLive(redraw=true){if(!online||!user)return;const result=await api('/api/runtime/sessions');liveEnabled=result.enabled;liveSessions=result.sessions;if(redraw&&view==='runtime')render();}
async function projectHash(files=current().files){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(validateFiles(files))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function loadLivePreview(sequence){const session=liveSessions.find(s=>s.projectId===current().id);if(!session)return false;const hash=await projectHash();if(sequence!==previewSequence||!$('#preview'))return true;if(session.state!=='running'||session.expires<=Date.now()||session.sourceHash!==hash){$('#preview').srcdoc='<h1 style="font:22px system-ui;padding:30px">Backend snapshot is not current.</h1><p style="font:14px system-ui;padding:0 30px">Return to Runtime, stop the previous server, and approve a new snapshot.</p>';if($('#preview-state'))$('#preview-state').textContent='Restart backend required';return true;}nonce=session.id;previewSourceHash=session.sourceHash;previewProjectId=session.projectId;$('#preview').src=session.url;if($('#preview-state'))$('#preview-state').textContent='Live backend / expires '+new Date(session.expires).toLocaleTimeString();return true;}
async function startLiveBackend(){
 if(liveBusy)return;if(!online||!user)throw Error('Start the local server and sign in.');if(!$('#live-consent')?.checked)throw Error('Approve the temporary backend first.');
 const projectId=current().id,account=user.id,files=validateFiles({...current().files}),source=workspaceSource(files);
 $('#live-consent').checked=false;liveError='';liveBusy=true;render();
 try{
  const session=await api('/api/runtime/sessions','POST',{files,projectId,confirm:true});
  if(user?.id!==account)return;liveSessions=[session];const until=Date.now()+45000;let ready=false;
  do{
   await refreshLive(false);if(user?.id!==account)return;
   const currentSession=liveSessions.find(s=>s.id===session.id);if(!currentSession)throw Error('Backend expired during startup.');
   if(['failed','cleanup-failed','interrupted'].includes(currentSession.state))throw Error(currentSession.error||'Backend failed; inspect its logs.');
   if(currentSession.state==='running'){
    ready=true;
    if(current().id===projectId&&workspaceSource(current().files)===source){useLivePreview=true;view='workspace';tab='preview';}
    toast(current().id===projectId&&workspaceSource(current().files)!==source?'Backend is ready for the earlier source snapshot. Stop and restart it to use your edits.':'Backend is ready.');break;
   }
   await new Promise(resolve=>setTimeout(resolve,1500));
  }while(Date.now()<until);
  if(!ready)throw Error('Backend did not become ready within 45 seconds. Inspect its logs in Runtime, then Stop it before retrying.');
  if(current().id===projectId)activity('backend','Backend session ready','Snapshot '+session.id);
 }catch(error){if(user?.id===account){liveError=error.message;toast(error.message);}}
 finally{liveBusy=false;render();}
}
async function liveAction(action,key){const session=liveSessions.find(s=>s.id===key);if(!session)throw Error('Backend session is unavailable.');if(action==='stop'){await api('/api/runtime/sessions/'+key+'/stop','POST',{});useLivePreview=false;await refreshLive();toast('Backend stopped. Temporary server state was discarded.');}if(action==='logs'){const result=await api('/api/runtime/sessions/'+key+'/logs');modal('Backend logs','<pre class="inline-code">'+esc(result.log||'No output yet.')+'</pre>');}if(action==='open'){const p=state.projects.find(p=>p.id===session.projectId);if(!p)throw Error('Original project is unavailable.');state.active=p.id;useLivePreview=true;view='workspace';tab='preview';save();render();}}
async function loadAccount(){const result=await api('/api/workspace');revision=result.revision;state=result.state?validateWorkspace(result.state):fresh();editSequence=0;savedSequence=0;syncBlocked=false;aiDraft='';aiOutcome=null;checks=[];logs=[];contextFiles=null;shared=[];runs=[];releases=[];compiled=null;buildResult=null;runtimeState=null;liveSessions=[];useLivePreview=false;liveError='';verificationReports=[];verificationHash='';verificationSelected=null;pendingBrowserReport=null;previewSequence++;clearTimeout(saveTimer);saveMessage='Saved on your laptop';if(!result.state)save();render();refreshStatus().catch(()=>{});refreshCommunity().catch(()=>{});}
function startOffline(){user=null;status=null;state=fresh();try{const saved=localStorage.getItem('agentdock.v2.offline');if(saved)state=validateWorkspace(JSON.parse(saved));}catch{}saveMessage='Browser only / server features unavailable';render();}
async function boot(){if(typeof location!=='undefined'&&(location.protocol==='file:'||location.protocol==='blob:'||(typeof document!=='undefined'&&document.title.includes('Browser-only')))){online=false;startOffline();return;}$('#app').innerHTML=`<div class="empty" style="padding:100px 20px;text-align:center;max-width:440px;margin:0 auto"><div style="width:48px;height:48px;border-radius:12px;background:var(--green,#245944);color:#ffffff;display:inline-grid;place-items:center;margin-bottom:20px;animation:statusPulse 1.8s infinite ease-in-out">${icon('layers')}</div><h2 style="font:600 20px Manrope,system-ui;margin:0 0 8px;letter-spacing:-0.5px">Opening your workspace...</h2><p style="font-size:12px;color:var(--muted,#7b8780);margin:0 0 20px;line-height:1.6">Connecting to local server...</p><button class="btn secondary" id="boot-offline-btn" style="padding:8px 14px;font-size:11px">Open offline workspace now</button></div>`;const btn=document.getElementById('boot-offline-btn');if(btn)btn.onclick=()=>{online=false;startOffline();};try{const result=await api('/api/bootstrap');online=true;user=result.user;if(user)await loadAccount();else authScreen(result.setupRequired);}catch{online=false;startOffline();}}
addEventListener('beforeunload',e=>{if(online&&user&&savedSequence<editSequence){e.preventDefault();e.returnValue='';}});
async function refreshVerification(){
 if(!online||!user){verificationReports=[];verificationHash='';if(view==='verification')render();return;}
 const projectId=current().id,account=user.id;
 const result=await api('/api/verification?projectId='+encodeURIComponent(projectId));
 if(user?.id!==account||current().id!==projectId)return;
 const hash=await projectHash();if(user?.id!==account||current().id!==projectId)return;verificationReports=result.reports;verificationHash=hash;if(view==='verification')render();
}
async function verifyCurrentSource(){
 if(verificationBusy)return;if(!online||!user)throw Error('Start the local server and sign in.');
 const project=current(),account=user.id,files=validateFiles({...project.files});verificationBusy=true;render();
 try{const report=await api('/api/verification','POST',{projectId:project.id,projectName:project.name,files});if(user?.id!==account||current().id!==project.id)return;verificationSelected=report.id;await refreshVerification();toast('Verification report saved. Browser and execution checks remain explicit.');}finally{verificationBusy=false;render();}
}
async function reportAction(action,key){
 if(action==='select'){verificationSelected=key;render();return;}
 if(action==='download'){const account=user?.id,report=await api('/api/verification/'+key);if(account!==user?.id)return;download('agentdock-verification-'+report.sourceHash.slice(0,12)+'.json',JSON.stringify(report,null,2));}
}
async function runSmokeTests(){
 if(!online||!user)throw Error('Browser checks require the local server preview.');
 if(pendingBrowserReport||verificationBusy)throw Error('Wait for the current verification to finish.');
 if(!$('#preview')||!previewReady){tab='preview';view='workspace';render();toast('Wait for the preview to become ready, then run browser checks again.');return;}
 const project=current(),files=validateFiles({...project.files}),hash=await projectHash(files),frame=$('#preview').contentWindow,previewNonce=nonce,account=user.id;
 if(hash!==previewSourceHash||previewProjectId!==project.id)throw Error('Preview does not match current source. Refresh it before running checks.');
 const mode=useLivePreview?'live':'static',testFile=mode==='live'&&files['agentdock.live-tests.json']?'agentdock.live-tests.json':'agentdock.tests.json';
 // Live previews without a separate fixture use the static fixture consistently.
 const reportMode=mode==='live'&&files['agentdock.live-tests.json']?'live':'static';
 let steps;try{steps=files[testFile]?JSON.parse(files[testFile]).steps:[{action:'exists',selector:'h1'}];}catch{throw Error(testFile+' must contain valid JSON.');}
 verificationBusy=true;
 try{
  const report=await api('/api/verification','POST',{projectId:project.id,projectName:project.name,files});
  const definition=report.fixtures.find(f=>f.mode===reportMode);if(!definition||definition.status!=='pass')throw Error('Fix the browser fixture definition before running checks.');
  if(user?.id!==account||current().id!==project.id||nonce!==previewNonce||hash!==await projectHash())throw Error('Project or preview changed. Run checks again.');
  const pending={id:report.id,files,hash,projectId:project.id,account,nonce:previewNonce,mode:reportMode,saving:false};
  pending.timer=setTimeout(()=>{if(pendingBrowserReport===pending){pendingBrowserReport=null;toast('Browser checks timed out. The report remains pending; no pass was recorded.');}},22000);
  pendingBrowserReport=pending;checks=report.staticChecks;frame.postMessage({agentdock:previewNonce,type:'test',steps},'*');toast('Running preview checks and saving this source snapshot report.');
 }finally{verificationBusy=false;}
}
async function completeBrowserVerification(data){
 const pending=pendingBrowserReport;if(!pending||pending.saving||pending.nonce!==nonce||pending.account!==user?.id)return;
 if(!Array.isArray(data)||data.length>30)throw Error('Invalid browser check response.');
 pending.saving=true;clearTimeout(pending.timer);
 try{
  const report=await api('/api/verification/'+pending.id+'/browser','POST',{files:pending.files,mode:pending.mode,checks:data});
  if(user?.id!==pending.account)return;
  verificationSelected=report.id;
  const currentHash=await projectHash();if(user?.id===pending.account&&current().id===pending.projectId&&currentHash===pending.hash){checks=[...report.staticChecks,...report.browser.checks.map(c=>({...c,browser:true}))];activity('check','Browser verification saved',report.status);tab='checks';render();toast('Browser checks saved. Open Verification to review the report.');}
  else toast('Report saved for the earlier source. Verify your current edits separately.');
 }finally{if(pendingBrowserReport===pending)pendingBrowserReport=null;}
}
function pythonEnvironmentPanel(){
 const python=names().some(name=>name.endsWith('.py'));
 return `<div class="section-heading"><h2>Project environment / ${esc(projectLanguage(current().files))}</h2><button class="text-button" data-action="inspect-environment">Inspect environment</button></div><section class="panel settings-card"><h2>Python tools</h2><p>Standard library, Flask, FastAPI and React + Python starters are available in New project. Curated packages: ${Object.entries(PYTHON_PACKAGES).map(([name,version])=>esc(name)+' '+esc(version)).join(' / ')}.</p><p>Rebuild the trusted image after this update. Dependencies are installed once into the image; requirements.txt declares supported pins. Project jobs have no network access or package installation.</p><label class="context-option"><input id="python-consent" type="checkbox">I approve this isolated Python job. Tests and scripts execute project code; output/state inside the job is temporary.</label><div class="settings-buttons" style="margin-top:16px">${[['python-syntax','Python syntax'],['python-test','Python unittest'],['python-pytest','Python pytest'],['python-run','Run Python script']].map(([action,label])=>`<button class="btn secondary" data-action="${action}" ${buildBusy||!python?'disabled':''}>${label}</button>`).join('')}</div><p>Syntax uses AST parsing without executing source. unittest/pytest discover test_*.py files. Run Python script requires kind: script in agentdock.runtime.json; web projects use Start current backend.</p></section>`;
}
function renameCurrentFile(){
 if(file==='index.html')throw Error('The project entry page keeps the name index.html.');
 const original=file,projectId=current().id,before=JSON.stringify(current().files);
 modal('Rename source file','<label class="field">New relative path<input id="rename-path" value="'+esc(original)+'" maxlength="160"></label><p>Review imports and asset references after renaming.</p>','<button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="rename-review">Review rename</button>');
 $('#rename-review').onclick=()=>{try{if(current().id!==projectId||JSON.stringify(current().files)!==before)throw Error('Project changed. Reopen the rename action.');const nextName=validatePath($('#rename-path').value.trim());if(nextName===original){$('#modal').close();return;}if(Object.hasOwn(current().files,nextName))throw Error('A file already uses that path.');const files={...current().files},content=files[original];delete files[original];files[nextName]=content;if(files['agentdock.runtime.json']){try{const config=JSON.parse(files['agentdock.runtime.json']);if(config.entry===original){config.entry=nextName;files['agentdock.runtime.json']=JSON.stringify(config,null,2);}}catch{}}propose('Rename '+original+' to '+nextName,validateFiles(files),'Review the rename and update dependent imports/references. Approval keeps a checkpoint.',0);}catch(error){toast(error.message);}};
}
function renderConsoleContent(){
 const filtered=consoleFilter==='all'?logs:logs.filter(l=>consoleFilter==='error'?l.level==='error':consoleFilter==='warn'?l.level==='warn':l.level!=='error'&&l.level!=='warn');
 if(!filtered.length)return `<div class="empty" style="padding:18px">${logs.length?'No logs matching "'+esc(consoleFilter)+'".':'Preview logs and runtime errors appear here. No AI tokens used.'}</div>`;
 return filtered.slice(-25).map(l=>{
  const time=l.time?new Date(l.time).toLocaleTimeString():'';
  return `<div class="console-line ${l.level==='error'?'console-error':''}">${time?`<span class="console-time">${esc(time)}</span>`:''}<span>${esc(l.level)}</span>${esc(l.text)}</div>`;
 }).join('');
}

function updateCursorInfo(){
 const ed=$('#editor'),cur=$('#editor-cursor'),sel=$('#editor-selection'),stats=$('#editor-stats');
 if(!ed||!cur)return;
 const text=ed.value,start=ed.selectionStart,end=ed.selectionEnd;
 const lines=text.slice(0,start).split('\n');
 cur.textContent=`Ln ${lines.length}, Col ${lines[lines.length-1].length+1}`;
 if(sel){if(end>start){sel.hidden=false;sel.textContent=`${end-start} selected`;}else sel.hidden=true;}
 if(stats){const count=text.split('\n').length;stats.textContent=`${count} lines • ${(text.length/1024).toFixed(1)} KB`;}
}

function formatActiveCode(){
 const ed=$('#editor');
 if(!ed||!current().files[file])return;
 const original=ed.value;
 const formatted=formatCode(original,file);
 if(formatted===original){toast('Code is already clean.');return;}
 ed.value=formatted;
 current().files[file]=formatted;
 ed.dispatchEvent(new Event('input'));
 toast(`Formatted ${file}.`);
}

function formatCode(content,filename){
 if(filename.endsWith('.json')){try{return JSON.stringify(JSON.parse(content),null,2)+'\n';}catch{return content;}}
 if(filename.endsWith('.html'))return formatHtml(content);
 if(filename.endsWith('.css'))return formatCss(content);
 if(filename.endsWith('.js')||filename.endsWith('.mjs'))return formatJs(content);
 if(filename.endsWith('.py'))return content.split('\n').map(l=>l.replace(/[ \t]+$/,'')).join('\n').trim()+'\n';
 return content;
}

function formatHtml(html){
 let indent=0,out='';
 const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 const tokens=html.split(/(<\/?[a-zA-Z0-9_-]+(?:\s+[^>]*?)?\/?>|<!--[\s\S]*?-->)/g);
 for(let token of tokens){
  token=token.trim();if(!token)continue;
  if(token.startsWith('</')){indent=Math.max(0,indent-1);out+='  '.repeat(indent)+token+'\n';}
  else if(token.startsWith('<')&&!token.startsWith('<!')&&!token.startsWith('<?')){
   const tag=(token.match(/^<([a-zA-Z0-9_-]+)/)||[])[1]?.toLowerCase();
   const isSelfClosing=token.endsWith('/>')||voidTags.has(tag);
   out+='  '.repeat(indent)+token+'\n';
   if(!isSelfClosing&&tag)indent++;
  }else out+='  '.repeat(indent)+token+'\n';
 }
 return out.trim()+'\n';
}

function formatCss(css){
 const blocks=css.replace(/\/\*[\s\S]*?\*\//g,'').split('}');
 let out='';
 for(let block of blocks){
  block=block.trim();if(!block)continue;
  const parts=block.split('{');
  if(parts.length===2){
   const selector=parts[0].trim(),decls=parts[1].split(';').map(d=>d.trim()).filter(Boolean);
   out+=selector+' {\n';
   for(const d of decls){
    const [prop,...vals]=d.split(':');
    if(prop&&vals.length)out+='  '+prop.trim()+': '+vals.join(':').trim()+';\n';
    else out+='  '+d+';\n';
   }
   out+='}\n\n';
  }else out+=block+'\n\n';
 }
 return out.trim()+'\n';
}

function formatJs(code){
 const lines=code.split('\n');let indent=0,out='';
 for(let line of lines){
  const trimmed=line.trim();if(!trimmed){out+='\n';continue;}
  if(trimmed.startsWith('}')||trimmed.startsWith(']')||trimmed.startsWith(')'))indent=Math.max(0,indent-1);
  out+='  '.repeat(indent)+trimmed+'\n';
  if(trimmed.endsWith('{')||trimmed.endsWith('[')||trimmed.endsWith('('))indent++;
 }
 return out.trim()+'\n';
}

function openEditorFind(){
 const bar=$('#editor-search-bar'),ed=$('#editor');
 if(!bar||!ed)return;
 bar.style.display='flex';
 const inp=$('#editor-find-input');
 if(inp){
  const sel=ed.value.slice(ed.selectionStart,ed.selectionEnd);
  if(sel&&!sel.includes('\n'))inp.value=sel;
  inp.focus();inp.select();findMatches();
 }
}

function closeEditorFind(){
 const bar=$('#editor-search-bar'),ed=$('#editor');
 if(bar)bar.style.display='none';
 if(ed)ed.focus();
}

function findMatches(){
 const ed=$('#editor'),inp=$('#editor-find-input'),countLabel=$('#editor-find-count');
 if(!ed||!inp)return;
 const query=inp.value;searchMatches=[];currentMatchIdx=-1;
 if(!query){if(countLabel)countLabel.textContent='No matches';return;}
 const text=matchCase?ed.value:ed.value.toLowerCase(),target=matchCase?query:query.toLowerCase();
 let idx=0;
 while((idx=text.indexOf(target,idx))!==-1){
  searchMatches.push({start:idx,end:idx+query.length});
  idx+=target.length||1;
 }
 if(searchMatches.length){
  const pos=ed.selectionStart,closest=searchMatches.findIndex(m=>m.start>=pos);
  currentMatchIdx=closest===-1?0:closest;
  highlightMatch(currentMatchIdx);
 }
 if(countLabel)countLabel.textContent=searchMatches.length?`${currentMatchIdx+1} of ${searchMatches.length}`:'No matches';
}

function highlightMatch(idx){
 const ed=$('#editor'),countLabel=$('#editor-find-count');
 if(!ed||!searchMatches.length||idx<0||idx>=searchMatches.length)return;
 const m=searchMatches[idx];
 ed.focus();ed.setSelectionRange(m.start,m.end);
 const lineCountBefore=ed.value.slice(0,m.start).split('\n').length;
 ed.scrollTop=Math.max(0,(lineCountBefore-4)*21.6);
 if(countLabel)countLabel.textContent=`${idx+1} of ${searchMatches.length}`;
 updateCursorInfo();
}

function nextMatch(){if(searchMatches.length){currentMatchIdx=(currentMatchIdx+1)%searchMatches.length;highlightMatch(currentMatchIdx);}}
function prevMatch(){if(searchMatches.length){currentMatchIdx=(currentMatchIdx-1+searchMatches.length)%searchMatches.length;highlightMatch(currentMatchIdx);}}

function replaceCurrentMatch(){
 const ed=$('#editor'),repInp=$('#editor-replace-input');
 if(!ed||!repInp||currentMatchIdx===-1||!searchMatches.length)return;
 const rep=repInp.value,m=searchMatches[currentMatchIdx];
 ed.setRangeText(rep,m.start,m.end,'end');
 ed.dispatchEvent(new Event('input'));
 findMatches();
}

function replaceAllMatches(){
 const ed=$('#editor'),findInp=$('#editor-find-input'),repInp=$('#editor-replace-input');
 if(!ed||!findInp||!repInp||!findInp.value)return;
 const repVal=repInp.value,count=searchMatches.length;
 if(!count)return;
 const pieces=[];
 let lastIdx=0;
 for(const m of searchMatches){
  pieces.push(ed.value.slice(lastIdx,m.start));
  pieces.push(repVal);
  lastIdx=m.end;
 }
 pieces.push(ed.value.slice(lastIdx));
 ed.value=pieces.join('');
 ed.dispatchEvent(new Event('input'));
 findMatches();
 toast(`Replaced ${count} occurrences.`);
}

function openCommandPalette(){
 let dlg=$('#palette-modal');
 if(!dlg){dlg=document.createElement('dialog');dlg.id='palette-modal';dlg.className='cmd-palette-dialog';document.body.appendChild(dlg);}
 const files=names();
 const commands=[
  {cat:'Views',icon:'code',title:'Open Workspace',desc:'Code editor, live preview & checks',run:()=>{view='workspace';tab='code';render();}},
  {cat:'Views',icon:'layers',title:'Open UI Library',desc:'Browse & integrate components',run:()=>{view='components';render();}},
  {cat:'Views',icon:'grid',title:'Open Projects',desc:'Switch or duplicate projects',run:()=>{view='projects';render();}},
  {cat:'Views',icon:'shield',title:'Open Verification',desc:'Audit reports & source fingerprints',run:()=>{view='verification';render();}},
  {cat:'Views',icon:'code',title:'Open Runtime',desc:'Container status, Python & React builds',run:()=>{view='runtime';render();}},
  {cat:'Views',icon:'external',title:'Open Releases',desc:'Immutable deployment snapshots',run:()=>{view='releases';render();}},
  {cat:'Views',icon:'settings',title:'Open Settings',desc:'Theme, limits & account settings',run:()=>{view='settings';render();}},
  {cat:'Actions',icon:'refresh',title:'Run / Refresh Preview',desc:'Update live sandbox preview',run:()=>action('refresh')},
  {cat:'Actions',icon:'shield',title:'Check Code',desc:'Static lint & source security checks',run:()=>action('check')},
  {cat:'Actions',icon:'shield',title:'Run Browser Smoke Tests',desc:'Functional DOM checks in sandbox',run:()=>action('smoke-test')},
  {cat:'Actions',icon:'code',title:'Format Active File',desc:'Auto-indent HTML/CSS/JS/Python/JSON',run:()=>formatActiveCode()},
  {cat:'Actions',icon:theme==='dark'?'sun':'moon',title:'Toggle Theme',desc:`Switch to ${theme==='dark'?'light':'pitch black'} mode`,run:()=>action('toggle-theme')},
  {cat:'Appearance',icon:'sidebar',title:'Reset Sidebar Width (220px)',desc:'Reset transition menu to default width',run:()=>action('reset-sidebar-width')},
  {cat:'Appearance',icon:'sidebar',title:'Toggle Transition Sidebar (Ctrl+B)',desc:'Expand or hide left navigation bar',run:()=>action('toggle-sidebar')},{cat:'Code Themes',icon:'spark',title:'Theme: Obsidian Black (AMOLED)',desc:'Pitch black with vivid contrast tokens',run:()=>{applyCodeTheme('obsidian');render();toast('Code theme: Obsidian Black');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: VS Code Dark+',desc:'Classic Microsoft VS Code dark syntax',run:()=>{applyCodeTheme('vs-dark');render();toast('Code theme: VS Code Dark+');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: Monokai Pro',desc:'Iconic magenta, yellow and green palette',run:()=>{applyCodeTheme('monokai');render();toast('Code theme: Monokai Pro');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: Dracula Dark',desc:'Purple and cyan gothic hacker theme',run:()=>{applyCodeTheme('dracula');render();toast('Code theme: Dracula Dark');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: VS Code Light+',desc:'Classic clean light syntax theme',run:()=>{applyCodeTheme('vs-light');render();toast('Code theme: VS Code Light+');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: GitHub Light',desc:'Clean crisp GitHub web editor colors',run:()=>{applyCodeTheme('github-light');render();toast('Code theme: GitHub Light');}},
  {cat:'Actions',icon:'plus',title:'Add Source File',desc:'Create a new file in workspace',run:()=>action('add-file')},
  {cat:'Actions',icon:'folder',title:'New Project',desc:'Create a new project workspace',run:()=>action('new')},
  {cat:'Actions',icon:'download',title:'Export Project ZIP',desc:'Download all source files as a ZIP',run:()=>action('export')},
  {cat:'Actions',icon:'download',title:'Export for Laptop',desc:'Export without Docker dependencies',run:()=>action('export-folder')},
  {cat:'Actions',icon:'spark',title:'Ask AI Assistant',desc:'Focus the build assistant prompt',run:()=>{view='workspace';render();setTimeout(()=>$('#prompt')?.focus(),50);}},
  {cat:'Actions',icon:'close',title:'Clear Console Logs',desc:'Wipe browser preview console logs',run:()=>action('clear-console')},
  ...files.map(f=>({
   cat:'Files',icon:f.endsWith('.html')?'code':f.endsWith('.py')?'layers':'code',title:f,desc:`Jump to ${f} (${((current().files[f]?.length||0)/1024).toFixed(1)} KB)`,run:()=>{file=f;view='workspace';if(tab==='preview')tab='code';render();}
  }))
 ];
 dlg.innerHTML=`<div class="palette-box"><div class="palette-header">${icon('search')}<input id="palette-search" placeholder="Type a command or jump to file... (↑ ↓ to move, Enter to run, Esc)" autocomplete="off" spellcheck="false"><kbd class="kbd">ESC</kbd></div><div id="palette-list" class="palette-list"></div><div class="palette-footer"><span>Navigate with <kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd></span><span>Select with <kbd class="kbd">Enter</kbd></span></div></div>`;
 let activeIdx=0,filtered=[];
 const input=dlg.querySelector('#palette-search'),list=dlg.querySelector('#palette-list');
 function renderList(q=''){
  const term=q.toLowerCase().trim();
  filtered=commands.filter(c=>!term||c.title.toLowerCase().includes(term)||c.desc.toLowerCase().includes(term)||c.cat.toLowerCase().includes(term));
  if(!filtered.length){list.innerHTML='<div class="empty" style="padding:24px">No matching commands or files.</div>';return;}
  if(activeIdx>=filtered.length)activeIdx=0;
  let html='',lastCat='';
  filtered.forEach((item,idx)=>{
   if(item.cat!==lastCat){lastCat=item.cat;html+=`<div class="palette-category">${esc(lastCat)}</div>`;}
   html+=`<div class="palette-item ${idx===activeIdx?'active':''}" data-idx="${idx}"><span class="palette-icon">${icon(item.icon)}</span><div class="palette-text"><strong>${esc(item.title)}</strong><small>${esc(item.desc)}</small></div><span class="palette-hint">${item.cat==='Files'?'File':'Action'}</span></div>`;
  });
  list.innerHTML=html;
  list.querySelectorAll('.palette-item').forEach(el=>{el.onclick=()=>{const idx=Number(el.dataset.idx);dlg.close();filtered[idx]?.run();};});
  const actEl=list.querySelector('.palette-item.active');if(actEl)actEl.scrollIntoView({block:'nearest'});
 }
 input.oninput=()=>{activeIdx=0;renderList(input.value);};
 input.onkeydown=e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(filtered.length){activeIdx=(activeIdx+1)%filtered.length;renderList(input.value);}}
  else if(e.key==='ArrowUp'){e.preventDefault();if(filtered.length){activeIdx=(activeIdx-1+filtered.length)%filtered.length;renderList(input.value);}}
  else if(e.key==='Enter'){e.preventDefault();if(filtered[activeIdx]){dlg.close();filtered[activeIdx].run();}}
  else if(e.key==='Escape'){dlg.close();}
 };
 dlg.onclick=e=>{if(e.target===dlg)dlg.close();};
 renderList('');
 dlg.showModal();
 input.focus();
}

if(typeof window!=='undefined'&&!window.__dockShortcutsBound){
 window.__dockShortcutsBound=true;
 window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){e.preventDefault();action('toggle-sidebar');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='m'){e.preventDefault();action('toggle-maximize');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='w'&&!e.shiftKey){
   if(view==='workspace'&&openTabs.length>1){e.preventDefault();closeTab(file);return;}
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandPalette();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();openCommandPalette();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&!e.shiftKey){
   if($('#editor')&&(document.activeElement===$('#editor')||$('#editor-search-bar'))){e.preventDefault();openEditorFind();return;}
  }
  if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();formatActiveCode();return;}
 });
}

if(typeof window!=='undefined'&&!window.__dockResizeBound){
 window.__dockResizeBound=true;
 window.addEventListener('resize',()=>{applySidebarWidth(sidebarWidth,false);});
}

boot();
