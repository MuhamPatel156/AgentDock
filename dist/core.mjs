export const FILES = ['index.html', 'styles.css', 'app.js'];
export const starter = () => ({
  'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My first application</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <nav class="navigation"><strong>orbit<span>✳</span></strong><a href="#features">Explore features ↗</a></nav>\n  <main>\n    <span class="eyebrow">YOUR NEXT GREAT IDEA</span>\n    <h1>A little space.<br>A lot of possibility.</h1>\n    <p>Turn a starting point into something that matters.<br>Your next application begins right here.</p>\n    <button id="start">Make it yours ↗</button>\n    <section id="features" class="features">\n      <article><span>01</span><h2>Start small.</h2><p>One idea. One working page.</p></article>\n      <article><span>02</span><h2>Build thoughtfully.</h2><p>Add the pieces you actually need.</p></article>\n      <article><span>03</span><h2>Ship something.</h2><p>Take your code wherever you go.</p></article>\n    </section>\n  </main>\n  <footer>Made with curiosity. Built with AgentDock.</footer>\n  <script src="app.js"></script>\n</body>\n</html>',
  'styles.css': ':root { color-scheme: light; font-family: system-ui, sans-serif; color: #183b33; background: #f6f4ee; }\n* { box-sizing: border-box; }\nbody { margin: 0; padding: 32px 8%; }\n.navigation { display: flex; justify-content: space-between; align-items: center; gap: 16px; }\n.navigation strong { font-size: 28px; letter-spacing: -1px; }\n.navigation span { color: #ef8656; margin-left: 6px; }\na { color: inherit; font-size: 12px; text-decoration: none; }\nmain { padding-top: 75px; }\n.eyebrow { font-size: 10px; letter-spacing: 2px; color: #65766a; }\nh1 { font-size: clamp(32px, 6vw, 66px); line-height: 1.08; letter-spacing: -3px; font-weight: 500; margin: 20px 0; }\nmain > p { color: #748078; font-size: 13px; line-height: 1.8; }\nbutton { background: #244d3f; color: white; padding: 14px 22px; border: 0; border-radius: 7px; cursor: pointer; margin-top: 12px; }\n.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 65px; padding-top: 25px; border-top: 1px solid #d7ded4; }\n.features span { color: #8c9b89; font-size: 11px; }\nh2 { font-size: 15px; font-weight: 500; }\n.features p { color: #748078; font-size: 11px; line-height: 1.7; }\nfooter { margin-top: 60px; font-size: 10px; color: #8c9b89; }\n@media(max-width: 480px) { .features { grid-template-columns: 1fr; } h1 { letter-spacing: -1px; } }',
  'app.js': "document.querySelector('#start').addEventListener('click', () => {\n  document.querySelector('#start').textContent = 'You’re ready to build ✓';\n});\n"
});
export const catalog = [
  {id:'stats',name:'Metric cards',category:'Dashboard',description:'Three clean metrics for your next dashboard.',color:'mint',html:'<section class="ad-metrics" aria-label="Project metrics"><article><small>Total projects</small><strong>24</strong><span>Ready to build</span></article><article><small>Active workflows</small><strong>08</strong><span>All systems running</span></article><article><small>Tasks completed</small><strong>142</strong><span>This month</span></article></section>',css:'.ad-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin:32px 0}.ad-metrics article{padding:24px;border:1px solid #d7ded4;border-radius:12px;background:#fff}.ad-metrics small,.ad-metrics span{display:block;font:12px system-ui;color:#61796c}.ad-metrics strong{display:block;font:38px system-ui;color:#244d3f;margin:12px 0}'},
  {id:'pricing',name:'Simple pricing',category:'Marketing',description:'A focused pricing card with an email action.',color:'peach',html:'<section class="ad-pricing"><span>THE ESSENTIALS</span><h2>Room to grow.</h2><p>A plan for your next big idea.</p><strong>$12 <small>/ month</small></strong><a href="mailto:hello@example.com">Contact sales ↗</a></section>',css:'.ad-pricing{max-width:360px;border:1px solid #d7ded4;border-radius:16px;background:#fff;padding:32px;margin:32px auto;font-family:system-ui;color:#244d3f}.ad-pricing>span{font-size:10px;letter-spacing:2px}.ad-pricing strong{display:block;font-size:42px;margin:24px 0}.ad-pricing small{font-size:13px;color:#61796c}.ad-pricing a{display:block;text-align:center;background:#244d3f;color:white;padding:14px;border-radius:8px;text-decoration:none}'},
  {id:'faq',name:'Accordion FAQ',category:'Marketing',description:'Accessible native disclosures. No extra libraries.',color:'lavender',html:'<section class="ad-faq"><h2>A few good questions.</h2><details><summary>Can I take my code with me?</summary><p>Yes. Export your source files and host them wherever you like.</p></details><details><summary>Do I need extra libraries?</summary><p>This component uses standard HTML and CSS.</p></details><details><summary>Can I customize the design?</summary><p>Every line of this component is yours to edit.</p></details></section>',css:'.ad-faq{margin:40px 0;font-family:system-ui;color:#244d3f}.ad-faq details{padding:18px 0;border-bottom:1px solid #d7ded4}.ad-faq summary{cursor:pointer;font-size:14px}.ad-faq p{font-size:13px;line-height:1.8;color:#61796c}'},
  {id:'contact',name:'Contact section',category:'Forms',description:'An email contact card, without a backend dependency.',color:'sand',html:'<section class="ad-contact"><div><small>LET’S TALK</small><h2>Something on your mind?</h2><p>We would love to hear about your next idea.</p></div><a href="mailto:hello@example.com">Say hello ↗</a></section>',css:'.ad-contact{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;background:#e8eddf;padding:32px;border-radius:16px;margin:32px 0;color:#244d3f;font-family:system-ui}.ad-contact small{font-size:10px;letter-spacing:2px}.ad-contact a{background:#244d3f;color:white;padding:14px 20px;border-radius:8px;text-decoration:none}.ad-contact p{font-size:13px}'},
];
export function validateFiles(files,{artifact=false}={}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw Error('A project must contain a files object.');
  if(typeof files['index.html']!=='string') throw Error('Missing text file: index.html');
  if(Object.keys(files).length>80)throw Error('Maximum 80 files per project.');
  const clean = {};let total=0;const folded=new Set();
  for (const key of Object.keys(files).sort()) {
    validatePath(key);
    if(folded.has(key.toLowerCase()))throw Error('File names must be unique even on a case-insensitive filesystem.');folded.add(key.toLowerCase());
    if (typeof files[key] !== 'string') throw Error('File must contain text: ' + key);
    if (files[key].length > (artifact?1000000:150000)) throw Error(key + ' exceeds the '+(artifact?'1 MB artifact':'150 KB editor')+' limit.');
    total+=files[key].length;if(total>1000000)throw Error('Project exceeds 1 MB of source text.');
    clean[key] = files[key];
  }
  return clean;
}
export function insertComponent(files, component) {
  const next = {...files};
  if (!/<\/body\s*>/i.test(next['index.html'])) throw Error('Add a closing </body> tag before inserting a component.');
  next['index.html'] = next['index.html'].replace(/<\/body\s*>/i, () => `\n<!-- AgentDock: ${component.name} -->\n${component.html}\n</body>`);
  next['styles.css'] = (next['styles.css']||'')+`\n\n/* AgentDock component */\n${component.css}\n`;
  if(!/href=["']styles.css["']/.test(next['index.html']))next['index.html']=next['index.html'].replace(/<\/head\s*>/i,'<link rel="stylesheet" href="styles.css">\n</head>');
  return validateFiles(next);
}
export function localChecks(files) {
  const html = files['index.html']; const checks=[];
  const add=(name,ok,message)=>checks.push({name,status:ok?'pass':'warn',message});
  add('Document structure', /<!doctype html>/i.test(html)&&/<html\b/i.test(html)&&/<\/body\s*>/i.test(html), 'Include a doctype, html element, and closing body tag.');
  add('Page title', /<title>\s*[^<]+<\/title>/i.test(html), 'Add a meaningful title in the document head.');
  add('Responsive viewport', /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html), 'Include a viewport meta tag for mobile layouts.');
  add('Image descriptions', ![...html.matchAll(/<img\b[^>]*>/gi)].some(x=>! /\balt\s*=/i.test(x[0])), 'Every image needs an alt attribute.');
  add('No obvious embedded credentials', !/sk-[a-zA-Z0-9_-]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY/.test(Object.values(files).join('\n')), 'Potential secret detected. Remove it; keep credentials on the server.');
  add('Local asset references', ![...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].some(([,s])=>!(s.replace(/^\.\//,'').split(/[?#]/)[0] in files)&&! /^(https?:|data:|#|mailto:|tel:|\/\/)/.test(s)), 'A local asset reference does not match a project file.');
  return checks;
}
export function repairMetadata(files) {
  let html=files['index.html']; const tags=[];
  if(!/<title>/i.test(html)) tags.push('<title>My application</title>');
  if(! /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) tags.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if(!tags.length) return null;
  if(!/<\/head\s*>/i.test(html)) throw Error('Add a closing </head> tag first.');
  html=html.replace(/<\/head\s*>/i,()=>tags.join('\n')+'\n</head>');
  return {...files,'index.html':html};
}
export function changedFiles(before,after) { return [...new Set([...Object.keys(before),...Object.keys(after)])].sort().filter(f=>before[f]!==after[f]); }
export function validatePath(name){
 if(typeof name!=='string'||name.length>160||! /^[a-zA-Z0-9_/-]+(?:\.[a-zA-Z0-9_-]+)+$/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.'))||/^(?:node_modules|vendor)\//i.test(name)||! /\.(html|css|js|mjs|json|md|txt|svg|jsx|tsx|ts|py|toml|yaml|yml|sql|csv|ini)$/i.test(name))throw Error('Use a safe relative source path, such as components/card.js.');
 return name;
}
export function validateWorkspace(input){
 if(!input||!Array.isArray(input.projects)||!input.projects.length||input.projects.length>20)throw Error('Workspace must contain 1-20 projects.');
 const ids=new Set();const projects=input.projects.map(p=>{
  if(typeof p.id!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(p.id)||ids.has(p.id))throw Error('Invalid or duplicate project ID.');ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>60)throw Error('Project name must be 1-60 characters.');
  return {id:p.id,name:p.name,files:validateFiles(p.files),updated:Number(p.updated)||Date.now(),checkpoints:(Array.isArray(p.checkpoints)?p.checkpoints:[]).slice(0,8).map(c=>({id:String(c.id).slice(0,80),label:String(c.label).slice(0,160),time:Number(c.time)||Date.now(),files:validateFiles(c.files)}))};
 });
 const settings={dailyLimit:Math.max(1000,Math.min(100000,Number(input.settings?.dailyLimit)||12000)),outputLimit:Math.max(256,Math.min(4096,Number(input.settings?.outputLimit)||1200))};
 const history=(Array.isArray(input.history)?input.history:[]).slice(0,100).map(h=>({id:String(h.id).slice(0,80),type:String(h.type).slice(0,30),title:String(h.title).slice(0,160),details:String(h.details).slice(0,1000),time:Number(h.time)||Date.now(),project:String(h.project).slice(0,60)}));
 const components=(Array.isArray(input.components)?input.components:[]).slice(0,30).map(validateComponent);
 return {projects,active:ids.has(input.active)?input.active:projects[0].id,settings,history,components};
}
export function validateComponent(c){
 if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>60||typeof c.html!=='string'||!c.html.trim()||c.html.length>20000||typeof c.css!=='string'||c.css.length>20000||typeof c.license!=='string'||!c.license.trim()||c.license.length>120)throw Error('Component needs a name, HTML, CSS and license; snippets may contain up to 20 KB each.');
 return {id:String(c.id||'').slice(0,80),name:c.name,html:c.html,css:c.css,license:c.license,category:['Dashboard','Marketing','Forms','Community'].includes(c.category)?c.category:'Community',description:String(c.description||c.license).slice(0,240),color:'mint',local:true};
}
