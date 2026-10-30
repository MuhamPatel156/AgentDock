// Only known support files are hidden. Source, tests and application data stay visible.
export function isSupportFile(name){
 const parts=name.toLowerCase().split('/'),base=parts.at(-1);
 return parts.some(part=>['node_modules','__pycache__','.pytest_cache','.venv','venv','.git','dist','build'].includes(part))||
  /^agentdock\..*\.json$/.test(base)||
  /^(readme|license|licence|changelog|contributing)(\.[a-z]+)?$/.test(base)||
  ['package.json','package-lock.json','yarn.lock','pnpm-lock.yaml','requirements.txt','pyproject.toml','pytest.ini','agent.config.json','vite.config.js','vite.config.mjs','vite.config.ts','tsconfig.json','jsconfig.json'].includes(base);
}
export function visibleSourceFiles(files,{showAll=false,query=''}={}){
 const term=query.trim().toLowerCase();
 // Searching includes support files so a known filename is always discoverable.
 return Object.keys(files).sort().filter(name=>(showAll||term||!isSupportFile(name))&&name.toLowerCase().includes(term));
}
export function matchingJob(result,projectId){return result?.projectId===projectId?result:null;}
export function workspaceSource(files){return JSON.stringify(Object.fromEntries(Object.keys(files).sort().map(name=>[name,files[name]])));}
export function jobIsStale(result,files){return Boolean(result&&result.source!==workspaceSource(files));}
