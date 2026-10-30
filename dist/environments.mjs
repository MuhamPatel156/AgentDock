export const PYTHON_PACKAGES=Object.freeze({flask:'3.1.3',fastapi:'0.162.0',uvicorn:'0.54.0',pytest:'9.2.0'});
export const NODE_PACKAGES=Object.freeze({react:'19.3.1','react-dom':'19.3.1',vite:'8.3.5'});

export function projectLanguage(files){
 let config={};try{config=JSON.parse(files['agentdock.runtime.json']||'{}')||{};}catch{}
 const entry=typeof config.entry==='string'?config.entry:'';
 if(config.language==='python'||entry.endsWith('.py'))return 'python';
 if(config.language==='node'||entry.endsWith('.mjs')||entry.endsWith('.js'))return 'node';
 return files['app.py']!==undefined||files['main.py']!==undefined?'python':Object.keys(files).some(f=>/\.(jsx|tsx)$/.test(f))||files['server.mjs']!==undefined?'node':'static';
}
export function pythonRequirements(files){
 const packages=new Map();
 for(const raw of String(files['requirements.txt']||'').split(/\r?\n/)){
  const line=raw.split('#')[0].trim();if(!line)continue;
  const match=/^([a-zA-Z][a-zA-Z0-9_-]{0,50})(?:==([0-9]+(?:\.[0-9]+){1,3}))?$/.exec(line);
  if(!match)throw Error('Python requirements support curated package names and exact == pins. URLs, flags, ranges and local installs are not supported.');
  const name=match[1].toLowerCase().replaceAll('_','-'),version=Object.hasOwn(PYTHON_PACKAGES,name)?PYTHON_PACKAGES[name]:null;
  if(!version)throw Error('A Python package is outside the trusted catalog. Available: '+Object.keys(PYTHON_PACKAGES).join(', ')+'.');
  if(match[2]&&match[2]!==version)throw Error(name+' is preinstalled at '+version+'. Use that pin or rebuild a reviewed image.');
  packages.set(name,version);
 }
 return [...packages].map(([name,version])=>({name,version}));
}
export function nodeDependencies(files){
 if(!files['package.json'])return [];
 let pkg={};try{pkg=JSON.parse(files['package.json']);}catch{throw Error('package.json must contain valid JSON.');}
 const deps={...pkg.dependencies,...pkg.devDependencies},res=[];
 for(const [name,pin]of Object.entries(deps)){
  if(!Object.hasOwn(NODE_PACKAGES,name))throw Error('A Node package is outside the reviewed catalog: '+name);
  res.push({name,version:NODE_PACKAGES[name]});
 }
 return res;
}
