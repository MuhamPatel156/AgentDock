import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const studioPath = join(__dirname, '..', 'dist', 'studio.mjs');
const cssPath = join(__dirname, '..', 'dist', 'extension.css');

let studioCode = readFileSync(studioPath, 'utf8');

// 1. Add codeTheme state & applyCodeTheme
const themeStateCode = `
let codeTheme=(typeof localStorage!=='undefined'&&localStorage.getItem('agentdock.code-theme'))||(theme==='dark'?'obsidian':'vs-dark');
function applyCodeTheme(next){
 codeTheme=next;
 if(typeof document!=='undefined'&&document.documentElement){document.documentElement.setAttribute('data-code-theme',codeTheme);}
 try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.code-theme',codeTheme);}catch{}
}
applyCodeTheme(codeTheme);
`;

if (!studioCode.includes('let codeTheme=')) {
  studioCode = studioCode.replace(
    "applyTheme(theme);",
    () => "applyTheme(theme);\n" + themeStateCode.trim()
  );
}

// 2. Syntax highlighter functions
const highlighterFunctions = `
function updateHighlight(){
 const ed=$('#editor'),codeEl=$('#highlight-code'),hl=$('#editor-highlight');
 if(!ed||!codeEl)return;
 codeEl.innerHTML=highlightSyntax(ed.value,file);
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
 const regex=/(<!--[\\s\\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\\/?)([a-zA-Z0-9_-]+)((?:\\s+[a-zA-Z0-9_:-]+(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?)*\\s*)(\\/?>)/gi;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,doctype,tagOpen,tagName,tagAttrs,tagClose]=match;
  if(com)out+=\`<span class="tok-com">\${esc(com)}</span>\`;
  else if(doctype)out+=\`<span class="tok-doctype">\${esc(doctype)}</span>\`;
  else if(tagName){
   out+=esc(tagOpen)+\`<span class="tok-tag">\${esc(tagName)}</span>\`;
   if(tagAttrs){
    const attrRegex=/([a-zA-Z0-9_:-]+)(\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)?/g;
    let attrOut='',aLast=0,aMatch;
    while((aMatch=attrRegex.exec(tagAttrs))!==null){
     if(aMatch.index>aLast)attrOut+=esc(tagAttrs.slice(aLast,aMatch.index));
     const [,aName,aEq,aVal]=aMatch;
     attrOut+=\`<span class="tok-attr">\${esc(aName)}</span>\`;
     if(aEq)attrOut+=esc(aEq);
     if(aVal)attrOut+=aVal.startsWith('"')||aVal.startsWith("'")?\`<span class="tok-str">\${esc(aVal)}</span>\`:\`<span class="tok-val">\${esc(aVal)}</span>\`;
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
 const regex=/(\\/\\*[\\s\\S]*?\\*\\/)|(@[a-zA-Z-]+)|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|(#[a-fA-F0-9]{3,8}\\b)|(\\b\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\\b)|(!important\\b)|(\\b[a-zA-Z-]+(?=\\s*:))|([{}():;,])/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,atRule,str,hex,num,imp,prop,punc]=match;
  if(com)out+=\`<span class="tok-com">\${esc(com)}</span>\`;
  else if(atRule)out+=\`<span class="tok-kw">\${esc(atRule)}</span>\`;
  else if(str)out+=\`<span class="tok-str">\${esc(str)}</span>\`;
  else if(hex)out+=\`<span class="tok-color">\${esc(hex)}</span>\`;
  else if(num)out+=\`<span class="tok-num">\${esc(num)}</span>\`;
  else if(imp)out+=\`<span class="tok-kw">\${esc(imp)}</span>\`;
  else if(prop)out+=\`<span class="tok-prop">\${esc(prop)}</span>\`;
  else if(punc)out+=\`<span class="tok-op">\${esc(punc)}</span>\`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightJs(code){
 const regex=/(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|(\`(?:\\\\\`|[\\s\\S])*?\`|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|(\\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|from|of)\\b)|(\\b(?:true|false|null|undefined|NaN|Infinity)\\b)|(\\b(?:String|Number|Boolean|Array|Object|Function|Promise|Map|Set|JSON|Math|Date|RegExp|Error|Symbol|document|window|console|localStorage|sessionStorage|fetch|crypto)\\b)|(\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\())|(\\b(?:0x[a-fA-F0-9]+|\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b)|(=>|===|!==|==|!=|<=|>=|\\+\\+|--|&&|\\|\\||[+\\-*\\/%&|^!~?:=<>])/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,str,kw,val,type,fn,num,op]=match;
  if(com)out+=\`<span class="tok-com">\${esc(com)}</span>\`;
  else if(str)out+=\`<span class="tok-str">\${esc(str)}</span>\`;
  else if(kw)out+=\`<span class="tok-kw">\${esc(kw)}</span>\`;
  else if(val)out+=\`<span class="tok-const">\${esc(val)}</span>\`;
  else if(type)out+=\`<span class="tok-type">\${esc(type)}</span>\`;
  else if(fn)out+=\`<span class="tok-fn">\${esc(fn)}</span>\`;
  else if(num)out+=\`<span class="tok-num">\${esc(num)}</span>\`;
  else if(op)out+=\`<span class="tok-op">\${esc(op)}</span>\`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightPython(code){
 const regex=/(#[^\\n]*)|("""[\\s\\S]*?"""|'''[\\s\\S]*?'''|(?:f|r|b)?'(?:\\\\.|[^'\\\\])*'|(?:f|r|b)?"(?:\\\\.|[^"\\\\])*")|(\\b(?:def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|pass|raise|break|continue|lambda|async|await|and|or|not|is|in|global|nonlocal|assert)\\b)|(\\b(?:True|False|None)\\b)|(\\b(?:print|len|range|str|int|float|list|dict|set|tuple|open|type|enumerate|zip|isinstance|sum|min|max|any|all|map|filter)\\b)|(\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\())|(\\b\\d+(?:\\.\\d+)?\\b)|([+\\-*\\/%&|^!~=<>]=?|==|!=|<=|>=)/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,com,str,kw,val,built,fn,num,op]=match;
  if(com)out+=\`<span class="tok-com">\${esc(com)}</span>\`;
  else if(str)out+=\`<span class="tok-str">\${esc(str)}</span>\`;
  else if(kw)out+=\`<span class="tok-kw">\${esc(kw)}</span>\`;
  else if(val)out+=\`<span class="tok-const">\${esc(val)}</span>\`;
  else if(built)out+=\`<span class="tok-type">\${esc(built)}</span>\`;
  else if(fn)out+=\`<span class="tok-fn">\${esc(fn)}</span>\`;
  else if(num)out+=\`<span class="tok-num">\${esc(num)}</span>\`;
  else if(op)out+=\`<span class="tok-op">\${esc(op)}</span>\`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}

function highlightJson(code){
 const regex=/("(?:\\\\.|[^"\\\\])*"(?=\\s*:))|("(?:\\\\.|[^"\\\\])*")|(\\b(?:true|false|null)\\b)|(\\b-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)/g;
 let out='',lastIdx=0,match;
 while((match=regex.exec(code))!==null){
  if(match.index>lastIdx)out+=esc(code.slice(lastIdx,match.index));
  const [full,key,str,val,num]=match;
  if(key)out+=\`<span class="tok-attr">\${esc(key)}</span>\`;
  else if(str)out+=\`<span class="tok-str">\${esc(str)}</span>\`;
  else if(val)out+=\`<span class="tok-const">\${esc(val)}</span>\`;
  else if(num)out+=\`<span class="tok-num">\${esc(num)}</span>\`;
  else out+=esc(full);
  lastIdx=regex.lastIndex;
 }
 if(lastIdx<code.length)out+=esc(code.slice(lastIdx));
 return out;
}
`;

if (!studioCode.includes('function highlightSyntax(')) {
  studioCode = studioCode.replace(
    'function updateDiagnostics(text,name){',
    () => highlighterFunctions.trim() + '\n\nfunction updateDiagnostics(text,name){'
  );
}

// 3. Update editorPanel() to render .editor-stage and #editor-highlight and code-theme-picker
const updatedEditorPanel = `function editorPanel(){
 const visible=new Set(visibleSourceFiles(current().files,{showAll:showSupportFiles,query:fileQuery}));
 const lineCount=(current().files[file]||'').split('\\n').length;
 const sizeKb=((current().files[file]?.length||0)/1024).toFixed(1);
 const ext=file.split('.').pop().toUpperCase();
 return \`<div class="code-pane"><div class="file-browser"><div class="file-tree-head">FILES<button data-action="add-file" aria-label="Add file">+</button></div><input id="file-search" aria-label="Find source file" placeholder="Find any file..." value="\${esc(fileQuery)}"><label class="file-visibility"><input id="show-support-files" type="checkbox" \${showSupportFiles?'checked':''}>Show all files</label><small id="file-count" class="file-count">\${visible.size} of \${names().length} files</small>\${names().map(n=>\`<button class="tree-file \${file===n?'active':''}" data-file="\${esc(n)}" title="\${esc(n)}\${isSupportFile(n)?' (support file)':''}" \${visible.has(n)?'':'hidden'}>\${icon(n.endsWith('.html')?'code':'layers')}<span>\${esc(n)}</span></button>\`).join('')}<p id="file-empty" class="file-count" \${visible.size?'hidden':''}>No matching files. Try Show all files.</p><button class="text-button" style="margin:15px 9px" data-action="upload-files">Import files</button></div><div class="editor-wrap"><div class="file-tabs"><span class="file-tab active">\${esc(file)}</span><button class="text-button" data-action="format-code" title="Format Code (Alt+Shift+F)">Format</button><button class="text-button" data-action="open-find" title="Find & Replace (Ctrl+F)">Find</button><button class="text-button" data-action="download-file">Download</button>\${file!=='index.html'?'<button class="text-button" data-action="rename-file">Rename</button>':''}\${file!=='index.html'?'<button class="text-button" style="margin-left:auto;padding:0 12px" data-action="delete-file">Remove</button>':''}</div><div id="editor-search-bar" class="editor-search-bar" style="display:none"><div class="search-inputs"><div class="search-input-wrap"><input id="editor-find-input" placeholder="Find in \${esc(file)}..." aria-label="Find in file"><span id="editor-find-count" class="find-count">No matches</span><button class="icon-btn" id="find-prev" title="Previous match (Shift+Enter)">↑</button><button class="icon-btn" id="find-next" title="Next match (Enter)">↓</button><button class="icon-btn" id="find-case" title="Match case">Aa</button></div><div class="replace-input-wrap"><input id="editor-replace-input" placeholder="Replace with..." aria-label="Replace with"><button class="btn secondary sm" id="btn-replace" title="Replace current match">Replace</button><button class="btn secondary sm" id="btn-replace-all" title="Replace all matches">Replace All</button></div></div><button class="icon-btn close-search" id="close-search" title="Close (Escape)">✕</button></div><div class="editor-container" data-code-theme="\${esc(codeTheme)}"><div id="line-numbers" class="line-numbers">1</div><div class="editor-stage"><pre id="editor-highlight" aria-hidden="true"><code id="highlight-code">\${highlightSyntax(current().files[file]||'',file)}</code></pre><textarea id="editor" aria-label="Source code for \${esc(file)}" spellcheck="false" autocapitalize="off">\${esc(current().files[file])}</textarea></div></div><div class="editor-status-bar"><div class="editor-bar-left"><span id="editor-diag" class="diag-ok">✓ Clean syntax</span><span id="editor-cursor" class="editor-meta-pill">Ln 1, Col 1</span><span id="editor-selection" class="editor-meta-pill" hidden>0 chars</span></div><div class="editor-bar-right"><select id="code-theme-picker" class="editor-theme-select" title="Syntax Highlighting Theme"><option value="obsidian" \${codeTheme==='obsidian'?'selected':''}>Obsidian Black</option><option value="vs-dark" \${codeTheme==='vs-dark'?'selected':''}>VS Code Dark+</option><option value="monokai" \${codeTheme==='monokai'?'selected':''}>Monokai Pro</option><option value="dracula" \${codeTheme==='dracula'?'selected':''}>Dracula</option><option value="vs-light" \${codeTheme==='vs-light'?'selected':''}>VS Code Light+</option><option value="github-light" \${codeTheme==='github-light'?'selected':''}>GitHub Light</option></select><span id="editor-stats" class="editor-meta-pill">\${lineCount} lines • \${sizeKb} KB</span><span class="editor-lang-badge">\${esc(ext)}</span><button class="text-button editor-bar-action" id="toggle-wrap-btn" title="Toggle Word Wrap">Wrap: Off</button></div></div></div></div>\`;
}`;

if (studioCode.includes('function editorPanel()')) {
  const start = studioCode.indexOf('function editorPanel()');
  const end = studioCode.indexOf('function filterFileList()', start);
  if (start !== -1 && end !== -1) {
    studioCode = studioCode.slice(0, start) + updatedEditorPanel + '\n' + studioCode.slice(end);
  }
}

// 4. Update updateLineNumbers() to also sync highlight scroll
if (studioCode.includes('ln.scrollTop=ed.scrollTop;')) {
  studioCode = studioCode.replace(
    'ln.scrollTop=ed.scrollTop;',
    () => 'ln.scrollTop=ed.scrollTop;const hl=$(\'#editor-highlight\');if(hl){hl.scrollTop=ed.scrollTop;hl.scrollLeft=ed.scrollLeft;}'
  );
}

// 5. Update ed.oninput and ed.onscroll in bind()
if (!studioCode.includes('updateHighlight();\n   updateLineNumbers();')) {
  studioCode = studioCode.replace(
    'updateLineNumbers();\n   updateDiagnostics(e.target.value, file);',
    () => 'updateLineNumbers();\n   updateHighlight();\n   updateDiagnostics(e.target.value, file);'
  );
}

// 6. Connect code-theme-picker and updateHighlight on init in bind()
const bindCodeTheme = `
  updateHighlight();
  if($('#code-theme-picker')){$('#code-theme-picker').onchange=e=>{applyCodeTheme(e.target.value);const edc=$('.editor-container');if(edc)edc.setAttribute('data-code-theme',e.target.value);toast('Theme: '+e.target.options[e.target.selectedIndex].text);};}
`;

if (!studioCode.includes('bindCodeThemeAdded')) {
  studioCode = studioCode.replace(
    "if($('#toggle-wrap-btn'))$('#toggle-wrap-btn').onclick=()=>{",
    () => "/* bindCodeThemeAdded */\n" + bindCodeTheme.trim() + "\n  if($('#toggle-wrap-btn'))$('#toggle-wrap-btn').onclick=()=>{"
  );
}

// 7. Update wrap button toggle to also wrap pre#editor-highlight
if (!studioCode.includes('hl.style.whiteSpace=wrap')) {
  studioCode = studioCode.replace(
    "ed.style.whiteSpace=wrap?'pre':'pre-wrap';",
    () => "ed.style.whiteSpace=wrap?'pre':'pre-wrap';const hl=$('#editor-highlight');if(hl)hl.style.whiteSpace=wrap?'pre':'pre-wrap';"
  );
}

// 8. Add Code Themes in Settings Page
const settingsThemeCard = `<div class="toggle-row" style="margin-top:16px">Code editor theme<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn \${codeTheme==='obsidian'?'primary':'secondary'}" data-code-theme-set="obsidian">Obsidian Black</button><button class="btn \${codeTheme==='vs-dark'?'primary':'secondary'}" data-code-theme-set="vs-dark">VS Code Dark+</button><button class="btn \${codeTheme==='monokai'?'primary':'secondary'}" data-code-theme-set="monokai">Monokai</button><button class="btn \${codeTheme==='dracula'?'primary':'secondary'}" data-code-theme-set="dracula">Dracula</button><button class="btn \${codeTheme==='vs-light'?'primary':'secondary'}" data-code-theme-set="vs-light">VS Code Light+</button><button class="btn \${codeTheme==='github-light'?'primary':'secondary'}" data-code-theme-set="github-light">GitHub Light</button></div></div>`;

if (!studioCode.includes('data-code-theme-set')) {
  studioCode = studioCode.replace(
    '<button class="btn secondary" data-theme-set="system">System</button></div></div></section>',
    () => '<button class="btn secondary" data-theme-set="system">System</button></div></div>' + settingsThemeCard + '</section>'
  );

  // Bind data-code-theme-set in bind()
  studioCode = studioCode.replace(
    "document.querySelectorAll('[data-theme-set]').forEach(b=>b.onclick=()=>{",
    () => "document.querySelectorAll('[data-code-theme-set]').forEach(b=>b.onclick=()=>{applyCodeTheme(b.dataset.codeThemeSet);render();toast('Code theme: '+b.textContent);});\n document.querySelectorAll('[data-theme-set]').forEach(b=>b.onclick=()=>{"
  );
}

// 9. Add themes to Command Palette
const cmdPaletteThemes = `
  {cat:'Code Themes',icon:'spark',title:'Theme: Obsidian Black (AMOLED)',desc:'Pitch black with vivid contrast tokens',run:()=>{applyCodeTheme('obsidian');render();toast('Code theme: Obsidian Black');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: VS Code Dark+',desc:'Classic Microsoft VS Code dark syntax',run:()=>{applyCodeTheme('vs-dark');render();toast('Code theme: VS Code Dark+');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: Monokai Pro',desc:'Iconic magenta, yellow and green palette',run:()=>{applyCodeTheme('monokai');render();toast('Code theme: Monokai Pro');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: Dracula Dark',desc:'Purple and cyan gothic hacker theme',run:()=>{applyCodeTheme('dracula');render();toast('Code theme: Dracula Dark');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: VS Code Light+',desc:'Classic clean light syntax theme',run:()=>{applyCodeTheme('vs-light');render();toast('Code theme: VS Code Light+');}},
  {cat:'Code Themes',icon:'spark',title:'Theme: GitHub Light',desc:'Clean crisp GitHub web editor colors',run:()=>{applyCodeTheme('github-light');render();toast('Code theme: GitHub Light');}},
`;

if (!studioCode.includes('Theme: Obsidian Black (AMOLED)')) {
  studioCode = studioCode.replace(
    "{cat:'Actions',icon:theme==='dark'?'sun':'moon',title:'Toggle Theme',desc:`Switch to ${theme==='dark'?'light':'pitch black'} mode`,run:()=>action('toggle-theme')},",
    () => "{cat:'Actions',icon:theme==='dark'?'sun':'moon',title:'Toggle Theme',desc:`Switch to ${theme==='dark'?'light':'pitch black'} mode`,run:()=>action('toggle-theme')}," + cmdPaletteThemes.trim()
  );
}

writeFileSync(studioPath, studioCode, 'utf8');
console.log('Successfully updated dist/studio.mjs with syntax highlighting and code themes!');

// Now add syntax highlighting styles and theme definitions in dist/extension.css
let cssCode = readFileSync(cssPath, 'utf8');

const codeThemeStyles = `
/* ============================================================
   AgentDock Studio — Syntax Highlighting & Code Themes Engine
   ============================================================ */

.editor-stage {
  position: relative !important;
  flex: 1 !important;
  height: 100% !important;
  overflow: hidden !important;
  background: transparent !important;
}

#editor-highlight,
.code-pane .editor-wrap textarea#editor {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 14px 16px !important;
  border: none !important;
  font-family: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace !important;
  font-size: 12px !important;
  line-height: 1.8 !important;
  letter-spacing: 0px !important;
  white-space: pre !important;
  tab-size: 2 !important;
  box-sizing: border-box !important;
  overflow: auto !important;
  word-break: normal !important;
}

#editor-highlight {
  pointer-events: none !important;
  user-select: none !important;
  z-index: 1 !important;
  background: transparent !important;
  color: var(--tok-def, #e5e7eb) !important;
}

#editor-highlight code {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
  white-space: inherit !important;
  tab-size: inherit !important;
}

.code-pane .editor-wrap textarea#editor {
  z-index: 2 !important;
  color: transparent !important;
  caret-color: var(--tok-caret, #22c55e) !important;
  background: transparent !important;
  outline: none !important;
  resize: none !important;
  -webkit-text-fill-color: transparent !important;
}

.code-pane .editor-wrap textarea#editor::selection {
  background: var(--tok-sel, rgba(59, 130, 246, 0.35)) !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}

/* Syntax Token Typography */
.tok-kw { color: var(--tok-kw) !important; font-weight: 600; }
.tok-str { color: var(--tok-str) !important; }
.tok-fn { color: var(--tok-fn) !important; }
.tok-type { color: var(--tok-type) !important; font-weight: 500; }
.tok-num { color: var(--tok-num) !important; }
.tok-com { color: var(--tok-com) !important; font-style: italic; }
.tok-tag { color: var(--tok-tag) !important; font-weight: 600; }
.tok-attr { color: var(--tok-attr) !important; }
.tok-prop { color: var(--tok-prop) !important; }
.tok-op { color: var(--tok-op) !important; }
.tok-const { color: var(--tok-const) !important; font-weight: 500; }
.tok-color { color: var(--tok-color) !important; font-weight: 500; }
.tok-doctype { color: var(--tok-doctype) !important; font-style: italic; }
.tok-val { color: var(--tok-str) !important; }

/* Status Bar Theme Selector */
.editor-theme-select {
  font: 10px Consolas, monospace !important;
  background: rgba(0, 0, 0, 0.25) !important;
  border: 1px solid var(--line) !important;
  color: var(--muted) !important;
  border-radius: 4px !important;
  padding: 2px 6px !important;
  cursor: pointer;
  outline: none;
}
.editor-theme-select:hover, .editor-theme-select:focus {
  color: #ffffff !important;
  border-color: var(--green) !important;
}

/* 1. Theme: Obsidian Pitch Black (Default in Dark Mode) */
[data-code-theme="obsidian"],
[data-theme="dark"]:not([data-code-theme]) {
  --tok-bg: #000000;
  --tok-def: #f3f4f6;
  --tok-gutter-bg: #050505;
  --tok-gutter-fg: #52525b;
  --tok-gutter-border: #181818;
  --tok-kw: #38bdf8;
  --tok-str: #4ade80;
  --tok-fn: #facc15;
  --tok-type: #c084fc;
  --tok-num: #fb923c;
  --tok-com: #71717a;
  --tok-tag: #f472b6;
  --tok-attr: #38bdf8;
  --tok-prop: #38bdf8;
  --tok-op: #e5e7eb;
  --tok-const: #f87171;
  --tok-color: #fbbf24;
  --tok-doctype: #94a3b8;
  --tok-caret: #4ade80;
  --tok-sel: rgba(34, 197, 94, 0.35);
}

/* 2. Theme: VS Code Dark+ */
[data-code-theme="vs-dark"] {
  --tok-bg: #1e1e1e;
  --tok-def: #d4d4d4;
  --tok-gutter-bg: #1e1e1e;
  --tok-gutter-fg: #858585;
  --tok-gutter-border: #282828;
  --tok-kw: #569cd6;
  --tok-str: #ce9178;
  --tok-fn: #dcdcaa;
  --tok-type: #4ec9b0;
  --tok-num: #b5cea8;
  --tok-com: #6a9955;
  --tok-tag: #569cd6;
  --tok-attr: #9cdcfe;
  --tok-prop: #9cdcfe;
  --tok-op: #d4d4d4;
  --tok-const: #569cd6;
  --tok-color: #ce9178;
  --tok-doctype: #808080;
  --tok-caret: #ffffff;
  --tok-sel: rgba(38, 79, 120, 0.6);
}

/* 3. Theme: Monokai Pro */
[data-code-theme="monokai"] {
  --tok-bg: #272822;
  --tok-def: #f8f8f2;
  --tok-gutter-bg: #272822;
  --tok-gutter-fg: #90908a;
  --tok-gutter-border: #383830;
  --tok-kw: #f92672;
  --tok-str: #e6db74;
  --tok-fn: #a6e22e;
  --tok-type: #66d9ef;
  --tok-num: #ae81ff;
  --tok-com: #75715e;
  --tok-tag: #f92672;
  --tok-attr: #a6e22e;
  --tok-prop: #66d9ef;
  --tok-op: #f92672;
  --tok-const: #ae81ff;
  --tok-color: #e6db74;
  --tok-doctype: #75715e;
  --tok-caret: #f8f8f0;
  --tok-sel: rgba(73, 72, 62, 0.7);
}

/* 4. Theme: Dracula */
[data-code-theme="dracula"] {
  --tok-bg: #282a36;
  --tok-def: #f8f8f2;
  --tok-gutter-bg: #21222c;
  --tok-gutter-fg: #6272a4;
  --tok-gutter-border: #343746;
  --tok-kw: #ff79c6;
  --tok-str: #f1fa8c;
  --tok-fn: #50fa7b;
  --tok-type: #8be9fd;
  --tok-num: #bd93f9;
  --tok-com: #6272a4;
  --tok-tag: #ff79c6;
  --tok-attr: #50fa7b;
  --tok-prop: #8be9fd;
  --tok-op: #ff79c6;
  --tok-const: #bd93f9;
  --tok-color: #f1fa8c;
  --tok-doctype: #6272a4;
  --tok-caret: #f8f8f2;
  --tok-sel: rgba(68, 71, 90, 0.7);
}

/* 5. Theme: VS Code Light+ (Default in Light Mode) */
[data-code-theme="vs-light"],
:root:not([data-theme="dark"]):not([data-code-theme]) {
  --tok-bg: #ffffff;
  --tok-def: #000000;
  --tok-gutter-bg: #f8f8f8;
  --tok-gutter-fg: #237893;
  --tok-gutter-border: #e4e4e4;
  --tok-kw: #0000ff;
  --tok-str: #a31515;
  --tok-fn: #795e26;
  --tok-type: #267f99;
  --tok-num: #098658;
  --tok-com: #008000;
  --tok-tag: #800000;
  --tok-attr: #ff0000;
  --tok-prop: #001080;
  --tok-op: #000000;
  --tok-const: #0000ff;
  --tok-color: #a31515;
  --tok-doctype: #0000ff;
  --tok-caret: #000000;
  --tok-sel: rgba(173, 214, 255, 0.6);
}

/* 6. Theme: GitHub Light */
[data-code-theme="github-light"] {
  --tok-bg: #f6f8fa;
  --tok-def: #24292f;
  --tok-gutter-bg: #f6f8fa;
  --tok-gutter-fg: #8c959f;
  --tok-gutter-border: #d0d7de;
  --tok-kw: #cf222e;
  --tok-str: #0a3069;
  --tok-fn: #8250df;
  --tok-type: #953800;
  --tok-num: #0550ae;
  --tok-com: #6e7781;
  --tok-tag: #116329;
  --tok-attr: #0550ae;
  --tok-prop: #0550ae;
  --tok-op: #cf222e;
  --tok-const: #0550ae;
  --tok-color: #0a3069;
  --tok-doctype: #6e7781;
  --tok-caret: #24292f;
  --tok-sel: rgba(182, 218, 255, 0.6);
}

/* Apply Dynamic Token Theme to Container & Line Numbers */
.editor-container {
  background: var(--tok-bg) !important;
}
.line-numbers {
  background: var(--tok-gutter-bg) !important;
  color: var(--tok-gutter-fg) !important;
  border-right: 1px solid var(--tok-gutter-border) !important;
}
`;

if (!cssCode.includes('Syntax Highlighting & Code Themes Engine')) {
  cssCode = cssCode.trim() + '\n\n' + codeThemeStyles.trim() + '\n';
  writeFileSync(cssPath, cssCode, 'utf8');
  console.log('Successfully updated dist/extension.css with code theme styles!');
}
