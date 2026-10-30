import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const studioPath = join(__dirname, '..', 'dist', 'studio.mjs');
const cssPath = join(__dirname, '..', 'dist', 'extension.css');

let studioCode = readFileSync(studioPath, 'utf8');

// 1. Add sidebar icon to paths
if (!studioCode.includes("sidebar:'M3 3h18v18H3V3zm6 0v18'")) {
  studioCode = studioCode.replace(
    "moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',",
    () => "moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',sidebar:'M3 3h18v18H3V3zm6 0v18',maximize:'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',"
  );
}

// 2. Add state variables for sidebar, maximized editor, and multi-tabs
const multiTabState = `
let sidebarCollapsed=(typeof localStorage!=='undefined'&&localStorage.getItem('agentdock.sidebar-collapsed')==='true')||false;
let editorMaximized=false;
let openTabs=(typeof localStorage!=='undefined'&&JSON.parse(localStorage.getItem('agentdock.open-tabs')||'null'))||['index.html'];

function applySidebarState(){
 if(typeof document!=='undefined'&&document.body){
  document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);
 }
 try{if(typeof localStorage!=='undefined')localStorage.setItem('agentdock.sidebar-collapsed',String(sidebarCollapsed));}catch{}
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
`;

if (!studioCode.includes('let sidebarCollapsed=')) {
  studioCode = studioCode.replace(
    "let shared=[],runs=[],releases=[],checks=[],logs=[],nonce='',busy=false",
    () => multiTabState.trim() + "\nlet shared=[],runs=[],releases=[],checks=[],logs=[],nonce='',busy=false"
  );
}

// 3. Update topbar in render()
// Add sidebar toggle button and remove redundant icons from top-actions buttons
if (!studioCode.includes('sidebar-toggle-btn')) {
  studioCode = studioCode.replace(
    '<header class="topbar"><div class="breadcrumbs">',
    () => '<header class="topbar"><button class="btn secondary sidebar-toggle-btn" data-action="toggle-sidebar" title="Toggle Left Sidebar (Ctrl+B)" aria-label="Toggle Sidebar">${icon(\'sidebar\')}</button><div class="breadcrumbs">'
  );
  // Clean decorative icons on top-actions
  studioCode = studioCode.replace(
    `<button class="btn secondary" data-action="help">Quick guide \${icon('external')}</button><button class="btn primary" data-action="export">\${icon('download')} Export project</button>`,
    () => `<button class="btn secondary" data-action="help">Quick guide</button><button class="btn primary" data-action="export">Export project</button>`
  );
}

// 4. Update workspace()
// Pass editorMaximized class, clean icons on check & new buttons, clean summary strip
const oldWorkspaceHead = `<button class="btn secondary" data-action="check">\${icon('shield')} Check code</button><button class="btn primary" data-action="new">\${icon('plus')} New project</button>`;
const newWorkspaceHead = `<button class="btn secondary" data-action="check">Check code</button><button class="btn primary" data-action="new">New project</button>`;
if (studioCode.includes(oldWorkspaceHead)) {
  studioCode = studioCode.replace(oldWorkspaceHead, () => newWorkspaceHead);
}

// Clean summary strip: remove .summary-icon
const oldSummaryStrip = `<div class="summary-strip">\${[['folder','CURRENT PROJECT',current().name],['layers','SOURCE FILES',names().length+' files / '+(Object.values(current().files).join('').length/1024).toFixed(1)+' KB'],['shield','CHANGE POLICY','Review before applying'],['leaf','DAILY AI RESERVATION',status?\`\${status.used} / \${status.dailyLimit}\`:'0 tokens']].map(([i,label,value])=>\`<div class="summary-item"><div class="summary-icon">\${icon(i)}</div><div><small>\${label}</small><strong>\${esc(value)}</strong></div></div>\`).join('')}</div>`;
const newSummaryStrip = `<div class="summary-strip">\${[['CURRENT PROJECT',current().name],['SOURCE FILES',names().length+' files / '+(Object.values(current().files).join('').length/1024).toFixed(1)+' KB'],['CHANGE POLICY','Review before applying'],['DAILY AI RESERVATION',status?\`\${status.used} / \${status.dailyLimit}\`:'0 tokens']].map(([label,value])=>\`<div class="summary-item"><div><small>\${label}</small><strong>\${esc(value)}</strong></div></div>\`).join('')}</div>`;
if (studioCode.includes(oldSummaryStrip)) {
  studioCode = studioCode.replace(oldSummaryStrip, () => newSummaryStrip);
}

// Update studio-grid to include editorMaximized class
if (studioCode.includes('<div class="studio-grid">')) {
  studioCode = studioCode.replace(
    '<div class="studio-grid">',
    () => '<div class="studio-grid ${editorMaximized?\'editor-maximized\':\'\'}">'
  );
}

// 5. Update editorPanel() with Multi-Tab bar, clean tree dots, and enlarged layout
const multiTabEditorPanel = `function editorPanel(){
 ensureOpenTabs();
 const visible=new Set(visibleSourceFiles(current().files,{showAll:showSupportFiles,query:fileQuery}));
 const lineCount=(current().files[file]||'').split('\\n').length;
 const sizeKb=((current().files[file]?.length||0)/1024).toFixed(1);
 const ext=file.split('.').pop().toUpperCase();
 return \`<div class="code-pane"><div class="file-browser"><div class="file-tree-head">FILES<button data-action="add-file" aria-label="Add file">+</button></div><input id="file-search" aria-label="Find source file" placeholder="Find any file..." value="\${esc(fileQuery)}"><label class="file-visibility"><input id="show-support-files" type="checkbox" \${showSupportFiles?'checked':''}>Show all files</label><small id="file-count" class="file-count">\${visible.size} of \${names().length} files</small>\${names().map(n=>\`<button class="tree-file \${file===n?'active':''}" data-file="\${esc(n)}" title="\${esc(n)}\${isSupportFile(n)?' (support file)':''}" \${visible.has(n)?'':'hidden'}><span class="tree-file-dot \${file===n?'active':''}"></span><span>\${esc(n)}</span></button>\`).join('')}<p id="file-empty" class="file-count" \${visible.size?'hidden':''}>No matching files. Try Show all files.</p><button class="text-button" style="margin:15px 9px" data-action="upload-files">Import files</button></div><div class="editor-wrap"><div class="file-tabs-bar"><div class="file-tabs-scroll">\${openTabs.map(t=>\`<div class="file-tab-item \${t===file?'active':''}" data-tab-file="\${esc(t)}"><span class="file-tab-name">\${esc(t)}</span><button class="file-tab-close" data-close-tab="\${esc(t)}" title="Close \${esc(t)} (Ctrl+W)" aria-label="Close \${esc(t)}">✕</button></div>\`).join('')}<button class="file-tab-add" data-action="add-file" title="New file" aria-label="New file">+</button></div><div class="file-tabs-actions"><button class="text-button editor-bar-action" data-action="format-code" title="Format Code (Alt+Shift+F)">Format</button><button class="text-button editor-bar-action" data-action="open-find" title="Find & Replace (Ctrl+F)">Find</button><button class="text-button editor-bar-action" data-action="download-file" title="Download active file">Download</button>\${file!=='index.html'?'<button class="text-button editor-bar-action" data-action="rename-file">Rename</button>':''}\${file!=='index.html'?'<button class="text-button editor-bar-action" data-action="delete-file">Remove</button>':''}<button class="text-button editor-bar-action" data-action="toggle-maximize" id="btn-maximize-editor" title="Toggle Fullscreen / Zen Editor (Ctrl+M)">\${editorMaximized?'Restore':'Maximize'}</button></div></div><div id="editor-search-bar" class="editor-search-bar" style="display:none"><div class="search-inputs"><div class="search-input-wrap"><input id="editor-find-input" placeholder="Find in \${esc(file)}..." aria-label="Find in file"><span id="editor-find-count" class="find-count">No matches</span><button class="icon-btn" id="find-prev" title="Previous match (Shift+Enter)">↑</button><button class="icon-btn" id="find-next" title="Next match (Enter)">↓</button><button class="icon-btn" id="find-case" title="Match case">Aa</button></div><div class="replace-input-wrap"><input id="editor-replace-input" placeholder="Replace with..." aria-label="Replace with"><button class="btn secondary sm" id="btn-replace" title="Replace current match">Replace</button><button class="btn secondary sm" id="btn-replace-all" title="Replace all matches">Replace All</button></div></div><button class="icon-btn close-search" id="close-search" title="Close (Escape)">✕</button></div><div class="editor-container" data-code-theme="\${esc(codeTheme)}"><div id="line-numbers" class="line-numbers">1</div><div class="editor-stage"><pre id="editor-highlight" aria-hidden="true"><code id="highlight-code">\${highlightSyntax(current().files[file]||'',file)}</code></pre><textarea id="editor" aria-label="Source code for \${esc(file)}" spellcheck="false" autocapitalize="off">\${esc(current().files[file])}</textarea></div></div><div class="editor-status-bar"><div class="editor-bar-left"><span id="editor-diag" class="diag-ok">✓ Clean syntax</span><span id="editor-cursor" class="editor-meta-pill">Ln 1, Col 1</span><span id="editor-selection" class="editor-meta-pill" hidden>0 chars</span></div><div class="editor-bar-right"><select id="code-theme-picker" class="editor-theme-select" title="Syntax Highlighting Theme"><option value="obsidian" \${codeTheme==='obsidian'?'selected':''}>Obsidian Black</option><option value="vs-dark" \${codeTheme==='vs-dark'?'selected':''}>VS Code Dark+</option><option value="monokai" \${codeTheme==='monokai'?'selected':''}>Monokai Pro</option><option value="dracula" \${codeTheme==='dracula'?'selected':''}>Dracula</option><option value="vs-light" \${codeTheme==='vs-light'?'selected':''}>VS Code Light+</option><option value="github-light" \${codeTheme==='github-light'?'selected':''}>GitHub Light</option></select><span id="editor-stats" class="editor-meta-pill">\${lineCount} lines • \${sizeKb} KB</span><span class="editor-lang-badge">\${esc(ext)}</span><button class="text-button editor-bar-action" id="toggle-wrap-btn" title="Toggle Word Wrap">Wrap: Off</button></div></div></div></div>\`;
}`;

if (studioCode.includes('function editorPanel()')) {
  const start = studioCode.indexOf('function editorPanel()');
  const end = studioCode.indexOf('function filterFileList()', start);
  if (start !== -1 && end !== -1) {
    studioCode = studioCode.slice(0, start) + multiTabEditorPanel + '\n' + studioCode.slice(end);
  }
}

// 6. Update bind() to handle multi-tab clicks and sidebar state
const tabBindingCode = `
 applySidebarState();
 document.querySelectorAll('[data-tab-file]').forEach(el=>{
  el.onclick=e=>{
   if(e.target.closest('.file-tab-close'))return;
   openTab(el.dataset.tabFile);
  };
 });
 document.querySelectorAll('[data-close-tab]').forEach(btn=>{
  btn.onclick=e=>{
   e.stopPropagation();
   closeTab(btn.dataset.closeTab);
  };
 });
`;

if (!studioCode.includes('applySidebarState()')) {
  studioCode = studioCode.replace(
    "document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{file=b.dataset.file;render();});",
    () => tabBindingCode.trim() + "\n document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{openTab(b.dataset.file);});"
  );
}

// 7. Update action(a) handlers for sidebar and maximize
const sidebarActionHandlers = `
 if(a==='toggle-sidebar'){sidebarCollapsed=!sidebarCollapsed;applySidebarState();return;}
 if(a==='toggle-maximize'){editorMaximized=!editorMaximized;if(typeof document!=='undefined'&&document.body){document.body.classList.toggle('zen-mode',editorMaximized);}render();toast(editorMaximized?'Maximized editor':'Restored layout');return;}
`;

if (!studioCode.includes("a==='toggle-sidebar'")) {
  studioCode = studioCode.replace(
    "async function action(a){",
    () => "async function action(a){\n" + sidebarActionHandlers.trim()
  );
}

// 8. Add Ctrl+B, Ctrl+M, Ctrl+W shortcuts
const keyboardShortcuts = `
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){e.preventDefault();action('toggle-sidebar');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='m'){e.preventDefault();action('toggle-maximize');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='w'&&!e.shiftKey){
   if(view==='workspace'&&openTabs.length>1){e.preventDefault();closeTab(file);return;}
  }
`;

if (!studioCode.includes("e.key.toLowerCase()==='b'")) {
  studioCode = studioCode.replace(
    "if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){",
    () => keyboardShortcuts.trim() + "\n  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){"
  );
}

// 9. Add Command Palette entries
const paletteEntries = `
  {cat:'Editor',icon:'sidebar',title:'Toggle Left Sidebar (Ctrl+B)',desc:'Collapse or expand the left navigation bar',run:()=>action('toggle-sidebar')},
  {cat:'Editor',icon:'maximize',title:'Toggle Fullscreen / Zen Editor (Ctrl+M)',desc:'Expand code section to full viewport',run:()=>action('toggle-maximize')},
  {cat:'Editor',icon:'close',title:'Close Active Tab (Ctrl+W)',desc:\`Close \${file} tab\`,run:()=>closeTab(file)},
`;

if (!studioCode.includes('Toggle Left Sidebar (Ctrl+B)')) {
  studioCode = studioCode.replace(
    "{cat:'Actions',icon:'refresh',title:'Run / Refresh Preview'",
    () => paletteEntries.trim() + "\n  {cat:'Actions',icon:'refresh',title:'Run / Refresh Preview'"
  );
}

writeFileSync(studioPath, studioCode, 'utf8');
console.log('Successfully updated dist/studio.mjs with multi-tabs and collapsible sidebar!');

// Now update CSS styles in dist/extension.css
let cssCode = readFileSync(cssPath, 'utf8');

const layoutAndTabsCSS = `
/* ============================================================
   AgentDock Studio — Expanded Code Section, Multi-Tabs & Transition Sidebar
   ============================================================ */

/* Smooth Transition Sidebar */
.sidebar {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease !important;
}

body.sidebar-collapsed .sidebar {
  transform: translateX(-100%) !important;
  box-shadow: none !important;
}

.main {
  transition: margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

body.sidebar-collapsed .main {
  margin-left: 0 !important;
}

.sidebar-toggle-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 8px 10px !important;
  cursor: pointer !important;
  margin-right: 6px !important;
}
.sidebar-toggle-btn .icon {
  width: 17px !important;
  height: 17px !important;
}

/* Enlarged High-Productivity Code Section */
.workspace-area {
  min-height: 680px !important;
  height: clamp(640px, 72vh, 940px) !important;
}

.code-pane {
  display: flex !important;
  min-width: 0 !important;
  height: 100% !important;
}

.code-pane .editor-wrap {
  min-width: 0 !important;
  flex: 1 !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

.editor-container {
  position: relative !important;
  display: flex !important;
  flex: 1 !important;
  height: 100% !important;
  overflow: hidden !important;
}

.line-numbers {
  width: 48px !important;
  padding: 14px 10px 14px 0 !important;
  font: 12px/1.8 Consolas, 'Cascadia Code', monospace !important;
  text-align: right !important;
}

/* Maximized / Zen Mode */
.studio-grid.editor-maximized {
  grid-template-columns: 1fr !important;
}

.editor-maximized .assistant {
  display: none !important;
}

body.zen-mode .page-head,
body.zen-mode .summary-strip,
body.zen-mode .section-heading,
body.zen-mode .console-filter-bar,
body.zen-mode .console-panel,
body.zen-mode .component-grid,
body.zen-mode .bottom-note {
  display: none !important;
}

body.zen-mode .workspace-area {
  height: calc(100vh - 130px) !important;
  min-height: calc(100vh - 130px) !important;
}

/* VS Code-style Multi-Tab Bar */
.file-tabs-bar {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  background: #edf2e4;
  border-bottom: 1px solid var(--line);
  min-height: 38px;
  overflow: hidden;
  user-select: none;
}

[data-theme="dark"] .file-tabs-bar {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}

.file-tabs-scroll {
  display: flex !important;
  align-items: center !important;
  flex: 1 !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scrollbar-width: none !important;
}
.file-tabs-scroll::-webkit-scrollbar {
  display: none !important;
}

.file-tab-item {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 9px 14px !important;
  font: 12px Consolas, 'Cascadia Code', monospace !important;
  color: var(--muted) !important;
  background: transparent;
  border-right: 1px solid var(--line);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s ease;
  position: relative;
}

.file-tab-item:hover {
  background: rgba(0, 0, 0, 0.04);
  color: inherit !important;
}

[data-theme="dark"] .file-tab-item:hover {
  background: #121212 !important;
  color: #f3f4f6 !important;
}

.file-tab-item.active {
  background: #ffffff !important;
  color: var(--green) !important;
  font-weight: 600;
  border-bottom: 2px solid var(--green);
}

[data-theme="dark"] .file-tab-item.active {
  background: #000000 !important;
  color: #4ade80 !important;
  border-bottom: 2px solid #22c55e !important;
  border-right-color: #1e1e1e !important;
}

.file-tab-close {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.12s ease;
}

.file-tab-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
  color: #ef4444;
}

[data-theme="dark"] .file-tab-close:hover {
  background: #222222;
  color: #f87171;
}

.file-tab-add {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  margin: 0 4px;
  border-radius: 4px;
  transition: all 0.12s ease;
}

.file-tab-add:hover {
  background: rgba(0, 0, 0, 0.05);
  color: inherit;
}

[data-theme="dark"] .file-tab-add:hover {
  background: #181818;
  color: #ffffff;
}

.file-tabs-actions {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 0 10px !important;
  flex-shrink: 0 !important;
}

/* File Tree Clean Minimalist Dot Indicator */
.tree-file-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
  opacity: 0.45;
  transition: all 0.15s ease;
}

.tree-file-dot.active {
  background: var(--green);
  opacity: 1;
  box-shadow: 0 0 6px var(--green);
}

[data-theme="dark"] .tree-file-dot.active {
  background: #4ade80 !important;
  box-shadow: 0 0 8px #4ade80 !important;
}
`;

if (!cssCode.includes('Expanded Code Section, Multi-Tabs & Transition Sidebar')) {
  cssCode = cssCode.trim() + '\n\n' + layoutAndTabsCSS.trim() + '\n';
  writeFileSync(cssPath, cssCode, 'utf8');
  console.log('Successfully updated dist/extension.css with layout and multi-tab styles!');
}
