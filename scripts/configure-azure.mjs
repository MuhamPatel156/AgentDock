import readline from 'node:readline';
import {Writable} from 'node:stream';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {protectSecret} from './windows-secret.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.stdin.isTTY||process.platform!=='win32')throw Error('Run this setup yourself in an interactive Windows terminal. Never send your key through chat.');
let muted=false;const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk);done();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
const ask=prompt=>new Promise(resolve=>rl.question(prompt,value=>resolve(value.trim())));
try{
 console.log('Azure OpenAI setup. This command makes no model requests.');
 console.log('Your key will be encrypted for this Windows user account (DPAPI).');
 const deployment=await ask('Azure deployment name (LLM_MODEL): ');if(!deployment)throw Error('Deployment name is required.');
 const base=await ask('Azure resource endpoint (AZURE_API_BASE): ');const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Enter an HTTPS resource endpoint without credentials or query parameters.');
 const style=(await ask('API style [v1 / legacy] (default v1): '))||'v1';if(!['v1','legacy'].includes(style))throw Error('Choose v1 or legacy.');
 const version=style==='legacy'?await ask('Azure API version from your deployment: '):'';if(style==='legacy'&&!version)throw Error('Legacy API version is required.');
 process.stdout.write('Azure API key (hidden input): ');muted=true;let key=await ask('');muted=false;process.stdout.write('\n');if(!key)throw Error('API key is required.');
 const encryptedKey=await protectSecret(key);key='';const dir=path.join(root,'.agentdock');await mkdir(dir,{recursive:true});
 // The setup file contains only deployment metadata and an encrypted key.
 await writeFile(path.join(dir,'azure.credentials.json'),JSON.stringify({version:1,deployment,base:url.href,style,apiVersion:version,encryptedKey},null,2),{mode:0o600});
 console.log('Saved encrypted Azure configuration. Start with npm start or START.cmd.');
 console.log('The encrypted key can be unlocked only by this Windows user account.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{muted=false;rl.close();}
