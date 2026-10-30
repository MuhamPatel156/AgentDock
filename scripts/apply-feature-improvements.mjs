import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const studioPath = join(__dirname, '..', 'dist', 'studio.mjs');
const cssPath = join(__dirname, '..', 'dist', 'extension.css');

let studioCode = readFileSync(studioPath, 'utf8');

// 1. Extend paths with search, command, filter icons
if (!studioCode.includes("search:'m21 21-4.35-4.35")) {
  studioCode = studioCode.replace(
    "moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'",
    () => "moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',search:'m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',command:'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',filter:'M22 3H2l8 9.46V19l4 2v-8.54L22 3z'"
  );
}

// 2. Add Topbar Command Palette trigger button
if (!studioCode.includes('cmd-palette-btn')) {
  studioCode = studioCode.replace(
    '<button class="btn secondary theme-toggle-btn"',
    () => '<button class="btn secondary cmd-palette-btn" data-action="open-palette" title="Command Palette (Ctrl+K / ⌘K)" aria-label="Command Palette">${icon(\'search\')} <span class="cmd-pill">Ctrl K</span></button><button class="btn secondary theme-toggle-btn"'
  );
}

// 3. Add state variables for find & replace, console filter
const stateVars = `
let searchMatches=[],currentMatchIdx=-1,matchCase=false,consoleFilter='all';
`;
if (!studioCode.includes('let searchMatches=')) {
  studioCode = studioCode.replace(
    "let shared=[],runs=[],releases=[],checks=[],logs=[],nonce='',busy=false",
    () => stateVars.trim() + "\nlet shared=[],runs=[],releases=[],checks=[],logs=[],nonce='',busy=false"
  );
}

// 4. Enhance editorPanel()
const newEditorPanel = `function editorPanel(){
 const visible=new Set(visibleSourceFiles(current().files,{showAll:showSupportFiles,query:fileQuery}));
 const lineCount=(current().files[file]||'').split('\\n').length;
 const sizeKb=((current().files[file]?.length||0)/1024).toFixed(1);
 const ext=file.split('.').pop().toUpperCase();
 return \`<div class="code-pane"><div class="file-browser"><div class="file-tree-head">FILES<button data-action="add-file" aria-label="Add file">+</button></div><input id="file-search" aria-label="Find source file" placeholder="Find any file..." value="\${esc(fileQuery)}"><label class="file-visibility"><input id="show-support-files" type="checkbox" \${showSupportFiles?'checked':''}>Show all files</label><small id="file-count" class="file-count">\${visible.size} of \${names().length} files</small>\${names().map(n=>\`<button class="tree-file \${file===n?'active':''}" data-file="\${esc(n)}" title="\${esc(n)}\${isSupportFile(n)?' (support file)':''}" \${visible.has(n)?'':'hidden'}>\${icon(n.endsWith('.html')?'code':'layers')}<span>\${esc(n)}</span></button>\`).join('')}<p id="file-empty" class="file-count" \${visible.size?'hidden':''}>No matching files. Try Show all files.</p><button class="text-button" style="margin:15px 9px" data-action="upload-files">Import files</button></div><div class="editor-wrap"><div class="file-tabs"><span class="file-tab active">\${esc(file)}</span><button class="text-button" data-action="format-code" title="Format Code (Alt+Shift+F)">Format</button><button class="text-button" data-action="open-find" title="Find & Replace (Ctrl+F)">Find</button><button class="text-button" data-action="download-file">Download</button>\${file!=='index.html'?'<button class="text-button" data-action="rename-file">Rename</button>':''}\${file!=='index.html'?'<button class="text-button" style="margin-left:auto;padding:0 12px" data-action="delete-file">Remove</button>':''}</div><div id="editor-search-bar" class="editor-search-bar" style="display:none"><div class="search-inputs"><div class="search-input-wrap"><input id="editor-find-input" placeholder="Find in \${esc(file)}..." aria-label="Find in file"><span id="editor-find-count" class="find-count">No matches</span><button class="icon-btn" id="find-prev" title="Previous match (Shift+Enter)">↑</button><button class="icon-btn" id="find-next" title="Next match (Enter)">↓</button><button class="icon-btn" id="find-case" title="Match case">Aa</button></div><div class="replace-input-wrap"><input id="editor-replace-input" placeholder="Replace with..." aria-label="Replace with"><button class="btn secondary sm" id="btn-replace" title="Replace current match">Replace</button><button class="btn secondary sm" id="btn-replace-all" title="Replace all matches">Replace All</button></div></div><button class="icon-btn close-search" id="close-search" title="Close (Escape)">✕</button></div><div class="editor-container"><div id="line-numbers" class="line-numbers">1</div><textarea id="editor" aria-label="Source code for \${esc(file)}" spellcheck="false" autocapitalize="off">\${esc(current().files[file])}</textarea></div><div class="editor-status-bar"><div class="editor-bar-left"><span id="editor-diag" class="diag-ok">✓ Clean syntax</span><span id="editor-cursor" class="editor-meta-pill">Ln 1, Col 1</span><span id="editor-selection" class="editor-meta-pill" hidden>0 chars</span></div><div class="editor-bar-right"><span id="editor-stats" class="editor-meta-pill">\${lineCount} lines • \${sizeKb} KB</span><span class="editor-lang-badge">\${esc(ext)}</span><button class="text-button editor-bar-action" id="toggle-wrap-btn" title="Toggle Word Wrap">Wrap: Off</button></div></div></div></div>\`;
}`;

if (studioCode.includes('function editorPanel()')) {
  const start = studioCode.indexOf('function editorPanel()');
  const end = studioCode.indexOf('function filterFileList()', start);
  if (start !== -1 && end !== -1) {
    studioCode = studioCode.slice(0, start) + newEditorPanel + '\n' + studioCode.slice(end);
  }
}

// 5. Enhance workspace() console section with filters & clear
const oldConsoleSection = `<div class="section-heading"><h2>Browser console & functional checks</h2><button class="text-button" data-action="smoke-test">\${icon('shield')} Run browser checks</button></div><div class="panel console-panel">\${logs.length?logs.slice(-15).map(l=>\`<div class="console-line \${l.level==='error'?'console-error':''}"><span>\${esc(l.level)}</span>\${esc(l.text)}</div>\`).join(''):'<div class="empty" style="padding:18px">Preview logs and runtime errors appear here. No AI tokens used.</div>'}</div>`;

const newConsoleSection = `<div class="section-heading"><h2>Browser console & functional checks</h2><div class="head-actions" style="margin:0;gap:8px"><button class="text-button" data-action="clear-console">Clear console</button><button class="text-button" data-action="smoke-test">\${icon('shield')} Run browser checks</button></div></div><div class="console-filter-bar"><button class="console-filter-btn \${consoleFilter==='all'?'active':''}" data-console-filter="all">All (\${logs.length})</button><button class="console-filter-btn \${consoleFilter==='error'?'active':''}" data-console-filter="error">Errors (\${logs.filter(l=>l.level==='error').length})</button><button class="console-filter-btn \${consoleFilter==='warn'?'active':''}" data-console-filter="warn">Warnings (\${logs.filter(l=>l.level==='warn').length})</button><button class="console-filter-btn \${consoleFilter==='info'?'active':''}" data-console-filter="info">Info (\${logs.filter(l=>l.level!=='error'&&l.level!=='warn').length})</button></div><div class="panel console-panel">\${renderConsoleContent()}</div>`;

if (studioCode.includes(oldConsoleSection)) {
  studioCode = studioCode.replace(oldConsoleSection, () => newConsoleSection);
}

// 6. Add Helper Functions before boot()
const helperFunctions = `
function renderConsoleContent(){
 const filtered=consoleFilter==='all'?logs:logs.filter(l=>consoleFilter==='error'?l.level==='error':consoleFilter==='warn'?l.level==='warn':l.level!=='error'&&l.level!=='warn');
 if(!filtered.length)return \`<div class="empty" style="padding:18px">\${logs.length?'No logs matching "'+esc(consoleFilter)+'".':'Preview logs and runtime errors appear here. No AI tokens used.'}</div>\`;
 return filtered.slice(-25).map(l=>{
  const time=l.time?new Date(l.time).toLocaleTimeString():'';
  return \`<div class="console-line \${l.level==='error'?'console-error':''}">\${time?\`<span class="console-time">\${esc(time)}</span>\`:''}<span>\${esc(l.level)}</span>\${esc(l.text)}</div>\`;
 }).join('');
}

function updateCursorInfo(){
 const ed=$('#editor'),cur=$('#editor-cursor'),sel=$('#editor-selection'),stats=$('#editor-stats');
 if(!ed||!cur)return;
 const text=ed.value,start=ed.selectionStart,end=ed.selectionEnd;
 const lines=text.slice(0,start).split('\\n');
 cur.textContent=\`Ln \${lines.length}, Col \${lines[lines.length-1].length+1}\`;
 if(sel){if(end>start){sel.hidden=false;sel.textContent=\`\${end-start} selected\`;}else sel.hidden=true;}
 if(stats){const count=text.split('\\n').length;stats.textContent=\`\${count} lines • \${(text.length/1024).toFixed(1)} KB\`;}
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
 toast(\`Formatted \${file}.\`);
}

function formatCode(content,filename){
 if(filename.endsWith('.json')){try{return JSON.stringify(JSON.parse(content),null,2)+'\\n';}catch{return content;}}
 if(filename.endsWith('.html'))return formatHtml(content);
 if(filename.endsWith('.css'))return formatCss(content);
 if(filename.endsWith('.js')||filename.endsWith('.mjs'))return formatJs(content);
 if(filename.endsWith('.py'))return content.split('\\n').map(l=>l.replace(/[ \\t]+$/,'')).join('\\n').trim()+'\\n';
 return content;
}

function formatHtml(html){
 let indent=0,out='';
 const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 const tokens=html.split(/(<\\/?[a-zA-Z0-9_-]+(?:\\s+[^>]*?)?\\/?>|<!--[\\s\\S]*?-->)/g);
 for(let token of tokens){
  token=token.trim();if(!token)continue;
  if(token.startsWith('</')){indent=Math.max(0,indent-1);out+='  '.repeat(indent)+token+'\\n';}
  else if(token.startsWith('<')&&!token.startsWith('<!')&&!token.startsWith('<?')){
   const tag=(token.match(/^<([a-zA-Z0-9_-]+)/)||[])[1]?.toLowerCase();
   const isSelfClosing=token.endsWith('/>')||voidTags.has(tag);
   out+='  '.repeat(indent)+token+'\\n';
   if(!isSelfClosing&&tag)indent++;
  }else out+='  '.repeat(indent)+token+'\\n';
 }
 return out.trim()+'\\n';
}

function formatCss(css){
 const blocks=css.replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').split('}');
 let out='';
 for(let block of blocks){
  block=block.trim();if(!block)continue;
  const parts=block.split('{');
  if(parts.length===2){
   const selector=parts[0].trim(),decls=parts[1].split(';').map(d=>d.trim()).filter(Boolean);
   out+=selector+' {\\n';
   for(const d of decls){
    const [prop,...vals]=d.split(':');
    if(prop&&vals.length)out+='  '+prop.trim()+': '+vals.join(':').trim()+';\\n';
    else out+='  '+d+';\\n';
   }
   out+='}\\n\\n';
  }else out+=block+'\\n\\n';
 }
 return out.trim()+'\\n';
}

function formatJs(code){
 const lines=code.split('\\n');let indent=0,out='';
 for(let line of lines){
  const trimmed=line.trim();if(!trimmed){out+='\\n';continue;}
  if(trimmed.startsWith('}')||trimmed.startsWith(']')||trimmed.startsWith(')'))indent=Math.max(0,indent-1);
  out+='  '.repeat(indent)+trimmed+'\\n';
  if(trimmed.endsWith('{')||trimmed.endsWith('[')||trimmed.endsWith('('))indent++;
 }
 return out.trim()+'\\n';
}

function openEditorFind(){
 const bar=$('#editor-search-bar'),ed=$('#editor');
 if(!bar||!ed)return;
 bar.style.display='flex';
 const inp=$('#editor-find-input');
 if(inp){
  const sel=ed.value.slice(ed.selectionStart,ed.selectionEnd);
  if(sel&&!sel.includes('\\n'))inp.value=sel;
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
 if(countLabel)countLabel.textContent=searchMatches.length?\`\${currentMatchIdx+1} of \${searchMatches.length}\`:'No matches';
}

function highlightMatch(idx){
 const ed=$('#editor'),countLabel=$('#editor-find-count');
 if(!ed||!searchMatches.length||idx<0||idx>=searchMatches.length)return;
 const m=searchMatches[idx];
 ed.focus();ed.setSelectionRange(m.start,m.end);
 const lineCountBefore=ed.value.slice(0,m.start).split('\\n').length;
 ed.scrollTop=Math.max(0,(lineCountBefore-4)*21.6);
 if(countLabel)countLabel.textContent=\`\${idx+1} of \${searchMatches.length}\`;
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
 toast(\`Replaced \${count} occurrences.\`);
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
  {cat:'Actions',icon:theme==='dark'?'sun':'moon',title:'Toggle Theme',desc:\`Switch to \${theme==='dark'?'light':'pitch black'} mode\`,run:()=>action('toggle-theme')},
  {cat:'Actions',icon:'plus',title:'Add Source File',desc:'Create a new file in workspace',run:()=>action('add-file')},
  {cat:'Actions',icon:'folder',title:'New Project',desc:'Create a new project workspace',run:()=>action('new')},
  {cat:'Actions',icon:'download',title:'Export Project ZIP',desc:'Download all source files as a ZIP',run:()=>action('export')},
  {cat:'Actions',icon:'download',title:'Export for Laptop',desc:'Export without Docker dependencies',run:()=>action('export-folder')},
  {cat:'Actions',icon:'spark',title:'Ask AI Assistant',desc:'Focus the build assistant prompt',run:()=>{view='workspace';render();setTimeout(()=>$('#prompt')?.focus(),50);}},
  {cat:'Actions',icon:'close',title:'Clear Console Logs',desc:'Wipe browser preview console logs',run:()=>action('clear-console')},
  ...files.map(f=>({
   cat:'Files',icon:f.endsWith('.html')?'code':f.endsWith('.py')?'layers':'code',title:f,desc:\`Jump to \${f} (\${((current().files[f]?.length||0)/1024).toFixed(1)} KB)\`,run:()=>{file=f;view='workspace';if(tab==='preview')tab='code';render();}
  }))
 ];
 dlg.innerHTML=\`<div class="palette-box"><div class="palette-header">\${icon('search')}<input id="palette-search" placeholder="Type a command or jump to file... (↑ ↓ to move, Enter to run, Esc)" autocomplete="off" spellcheck="false"><kbd class="kbd">ESC</kbd></div><div id="palette-list" class="palette-list"></div><div class="palette-footer"><span>Navigate with <kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd></span><span>Select with <kbd class="kbd">Enter</kbd></span></div></div>\`;
 let activeIdx=0,filtered=[];
 const input=dlg.querySelector('#palette-search'),list=dlg.querySelector('#palette-list');
 function renderList(q=''){
  const term=q.toLowerCase().trim();
  filtered=commands.filter(c=>!term||c.title.toLowerCase().includes(term)||c.desc.toLowerCase().includes(term)||c.cat.toLowerCase().includes(term));
  if(!filtered.length){list.innerHTML='<div class="empty" style="padding:24px">No matching commands or files.</div>';return;}
  if(activeIdx>=filtered.length)activeIdx=0;
  let html='',lastCat='';
  filtered.forEach((item,idx)=>{
   if(item.cat!==lastCat){lastCat=item.cat;html+=\`<div class="palette-category">\${esc(lastCat)}</div>\`;}
   html+=\`<div class="palette-item \${idx===activeIdx?'active':''}" data-idx="\${idx}"><span class="palette-icon">\${icon(item.icon)}</span><div class="palette-text"><strong>\${esc(item.title)}</strong><small>\${esc(item.desc)}</small></div><span class="palette-hint">\${item.cat==='Files'?'File':'Action'}</span></div>\`;
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
`;

if (!studioCode.includes('function openCommandPalette()')) {
  studioCode = studioCode.replace(
    'boot();',
    () => helperFunctions.trim() + '\n\nboot();'
  );
}

// 7. Update action(a) handlers
const actionHandlers = `
 if(a==='open-palette'){openCommandPalette();return;}
 if(a==='format-code'){formatActiveCode();return;}
 if(a==='open-find'){openEditorFind();return;}
 if(a==='clear-console'){logs=[];const p=$('.console-panel');if(p)p.innerHTML='<div class="empty" style="padding:18px">Console cleared.</div>';toast('Console cleared.');return;}
`;

if (!studioCode.includes("a==='open-palette'")) {
  studioCode = studioCode.replace(
    "async function action(a){",
    () => "async function action(a){\n" + actionHandlers.trim()
  );
}

// 8. Bind additional editor and search controls in bind()
const bindExtras = `
  ed.onkeyup=updateCursorInfo;
  ed.onclick=updateCursorInfo;
  ed.onselect=updateCursorInfo;
  updateCursorInfo();
  if($('#toggle-wrap-btn'))$('#toggle-wrap-btn').onclick=()=>{
   const wrap=ed.style.whiteSpace==='pre-wrap';
   ed.style.whiteSpace=wrap?'pre':'pre-wrap';
   $('#toggle-wrap-btn').textContent=wrap?'Wrap: Off':'Wrap: On';
  };
  if($('#editor-find-input')){$('#editor-find-input').oninput=findMatches;$('#editor-find-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(e.shiftKey)prevMatch();else nextMatch();}else if(e.key==='Escape')closeEditorFind();};}
  if($('#find-next'))$('#find-next').onclick=nextMatch;
  if($('#find-prev'))$('#find-prev').onclick=prevMatch;
  if($('#find-case'))$('#find-case').onclick=()=>{matchCase=!matchCase;$('#find-case').classList.toggle('active',matchCase);findMatches();};
  if($('#btn-replace'))$('#btn-replace').onclick=replaceCurrentMatch;
  if($('#btn-replace-all'))$('#btn-replace-all').onclick=replaceAllMatches;
  if($('#close-search'))$('#close-search').onclick=closeEditorFind;
`;

if (!studioCode.includes('ed.onkeyup=updateCursorInfo')) {
  studioCode = studioCode.replace(
    "updateDiagnostics(e.target.value, file);\n   if($('#run-output-stale')",
    () => "updateDiagnostics(e.target.value, file);\n   updateCursorInfo();\n   if($('#run-output-stale')"
  );
  studioCode = studioCode.replace(
    "updateDiagnostics(current().files[file], file);",
    () => "updateDiagnostics(current().files[file], file);\n" + bindExtras.trim()
  );
}

// 9. Bind console filter buttons
if (!studioCode.includes('[data-console-filter]')) {
  studioCode = studioCode.replace(
    "document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>Promise.resolve(action(b.dataset.action)).catch(e=>toast(e.message)));",
    () => "document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>Promise.resolve(action(b.dataset.action)).catch(e=>toast(e.message)));\n document.querySelectorAll('[data-console-filter]').forEach(b=>b.onclick=()=>{consoleFilter=b.dataset.consoleFilter;document.querySelectorAll('[data-console-filter]').forEach(el=>el.classList.toggle('active',el===b));const p=$('.console-panel');if(p)p.innerHTML=renderConsoleContent();});"
  );
}

// 10. Global keyboard shortcuts listener
const globalShortcuts = `
if(typeof window!=='undefined'&&!window.__dockShortcutsBound){
 window.__dockShortcutsBound=true;
 window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandPalette();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();openCommandPalette();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&!e.shiftKey){
   if($('#editor')&&(document.activeElement===$('#editor')||$('#editor-search-bar'))){e.preventDefault();openEditorFind();return;}
  }
  if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();formatActiveCode();return;}
 });
}
`;

if (!studioCode.includes('window.__dockShortcutsBound')) {
  studioCode = studioCode.replace(
    'boot();',
    () => globalShortcuts.trim() + '\n\nboot();'
  );
}

// 11. Ensure logs include time property
if (!studioCode.includes('time:Date.now()')) {
  studioCode = studioCode.replace(
    "logs.push({level:data.level,text:String(data.text).slice(0,1000)});",
    () => "logs.push({level:data.level,text:String(data.text).slice(0,1000),time:Date.now()});"
  );
  studioCode = studioCode.replace(
    "logs.push({level:'error',text:String(data).slice(0,1000)});",
    () => "logs.push({level:'error',text:String(data).slice(0,1000),time:Date.now()});"
  );
}

writeFileSync(studioPath, studioCode, 'utf8');
console.log('Successfully updated dist/studio.mjs with developer feature enhancements!');
