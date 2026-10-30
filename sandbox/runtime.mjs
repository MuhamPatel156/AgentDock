// Trusted supervisor. This process never receives platform credentials.
import {cp,mkdir,symlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
await cp('/input','/work',{recursive:true});
await symlink('/opt/agentdock/node_modules','/work/node_modules');
let child;
function run(args,binary=process.execPath){return new Promise((resolve,reject)=>{child=spawn(binary,args,{cwd:'/work',stdio:['ignore','inherit','inherit'],env:{PATH:process.env.PATH,NODE_ENV:'production',PORT:process.env.PORT,PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Process exited: '+code)));});}
const expiry=setTimeout(()=>{child?.kill('SIGTERM');process.exit(0);},Number(process.env.AGENTDOCK_LIFETIME_MS)||900000);
const stop=()=>{clearTimeout(expiry);child?.kill('SIGTERM');process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
try{
 if(process.env.AGENTDOCK_BUILD==='1'){
  const timer=setTimeout(()=>child?.kill('SIGKILL'),90000);
  try{await run(['/opt/agentdock/node_modules/vite/bin/vite.js','build','--config','/opt/agentdock/vite.config.mjs','--configLoader','native']);}finally{clearTimeout(timer);}
  await mkdir('/work/dist',{recursive:true});await cp('/out','/work/dist',{recursive:true});
 }
 console.log('AgentDock backend starting.');if(process.env.AGENTDOCK_LANGUAGE==='python')await run(['-I','-B','/opt/agentdock/python_entry.py','/work/'+process.env.AGENTDOCK_ENTRY,'/work'],'/opt/agentdock/venv/bin/python');else await run(['/work/'+process.env.AGENTDOCK_ENTRY]);
}catch(error){console.error(error.message);process.exitCode=1;}finally{clearTimeout(expiry);}
