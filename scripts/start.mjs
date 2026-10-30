import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {protectSecret} from './windows-secret.mjs';
import {createApplication} from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw Error('Unable to read local .env configuration.');}
if(!process.env.AZURE_API_KEY&&!process.env.AZURE_OPENAI_API_KEY&&!process.env.OPENAI_API_KEY&&!process.env.AI_API_KEY){
 try{const saved=JSON.parse(await readFile(path.join(root,'.agentdock','azure.credentials.json'),'utf8'));process.env.AZURE_API_KEY=await protectSecret(saved.encryptedKey,true);if(!process.env.LLM_MODEL&&!process.env.OPENAI_MODEL&&!process.env.AI_MODEL)process.env.LLM_MODEL=saved.deployment;if(!process.env.AZURE_API_BASE)process.env.AZURE_API_BASE=saved.base;process.env.AZURE_API_STYLE=saved.style;process.env.AZURE_API_VERSION=saved.apiVersion||'';}catch(e){if(e.code!=='ENOENT'){console.error('Unable to unlock saved Azure credentials. Run npm run configure:azure again under the same Windows account.');process.exit(1);}}
}
const app=await createApplication();
app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'AgentDock port is already in use. Close the older server and restart.':e.message);app.close();process.exitCode=1;});
app.server.listen(app.config.port,'127.0.0.1',()=>console.log(`AgentDock Studio v0.2: http://127.0.0.1:${app.config.port}\nStorage: SQLite on this laptop\nAI: ${app.config.aiKey&&app.config.aiModel?'configured; explicit request approval required':'OFF - zero API calls'}\nPress Ctrl+C to stop.`));
const stop=()=>app.server.close(async()=>{await app.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
