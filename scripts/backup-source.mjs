// Portable source-only archive: never walks runtime data, credentials or Git state.
import {readdir,readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipFiles} from '../lib/zip.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const files={};
async function add(relative){const full=path.join(root,relative);try{const stat=await lstat(full);if(!stat.isFile()||stat.isSymbolicLink())return;files[relative.replaceAll('\\','/')]=await readFile(full,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function walk(directory){for(const item of await readdir(path.join(root,directory),{withFileTypes:true})){if(item.name.startsWith('.')||item.name.startsWith('tmp-')||item.name==='__pycache__')continue;const relative=directory+'/'+item.name;if(item.isDirectory())await walk(relative);else if(item.isFile()&&(/\.(mjs|js|css|html|json|md|cmd|py|txt|ini)$/.test(item.name)||item.name==='Dockerfile'))await add(relative);}}
for(const directory of ['dist','lib','scripts','tests','sandbox'])await walk(directory);
for(const filename of ['server.mjs','preview.html','package.json','START.cmd','README.md','PLAN.md','PHASES.md','PHASE1_REPORT.md','PHASE2_REPORT.md','PHASE3_REPORT.md','VERIFICATION.md','BROWSER_QA.md','CONTINUE_HERE.md','PYTHON_ENVIRONMENTS.md','.env.example','.gitignore'])await add(filename);
const out=path.join(root,'outputs');await mkdir(out,{recursive:true});const zip=zipFiles(files);await writeFile(path.join(out,'agentdock-source.zip'),zip);
console.log(`Saved outputs/agentdock-source.zip (${Object.keys(files).length} source files, ${zip.length} bytes). Runtime databases, real .env files, credentials, and screenshots are excluded.`);
