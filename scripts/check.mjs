import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['server.mjs'];for(const directory of ['dist','lib','scripts','tests','sandbox'])for(const name of await readdir(path.join(root,directory)))if(name.endsWith('.mjs'))files.push(directory+'/'+name);
for(const file of files){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',windowsHide:true});if(result.status!==0){console.error(file+'\n'+result.stderr);process.exit(1);}}
console.log('Syntax checks passed: '+files.length+' JavaScript modules.');
