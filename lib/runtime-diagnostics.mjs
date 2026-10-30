import {runDocker} from './sandbox.mjs';

// Read-only local probes. Never inspect environment variables, images' secrets,
// project source, host mounts, container logs, or contact a model/provider.
export async function diagnoseRuntime({config={},execute=runDocker}={}){
 const checks=[],add=(name,status,message)=>checks.push({name,status,message});
 const nodeOK=Number(process.versions.node.split('.')[0])>=24;
 add('Node.js',nodeOK?'pass':'warn',process.version+(nodeOK?' is supported.':' requires an upgrade to Node.js 24+.'));
 for(const [key,name,setting]of [['enableBuilds','Build execution','AGENTDOCK_ENABLE_BUILDS'],['enableServers','Live backends','AGENTDOCK_ENABLE_SERVERS']])if(typeof config[key]==='boolean')add(name,config[key]?'pass':'info',config[key]?'Enabled in this server.':`Disabled. Set ${setting}=1 locally after preparing the trusted image, then restart.`);
 let cli;try{cli=await execute(['--version'],{timeout:4000});}catch{}
 if(!cli||cli.code!==0){add('Docker CLI','warn','Docker CLI is unavailable. Install Docker Desktop, then rerun this check.');return {ready:false,checks};}
 add('Docker CLI','pass','Docker CLI is available.');
 let engine,denied=false;try{const result=await execute(['version','--format','{{json .Server}}'],{timeout:5000});if(result.code===0)engine=JSON.parse(result.output);else denied=/access is denied|permission denied|\bEACCES\b|\bEPERM\b|not permitted/i.test(result.output||'');}catch(error){denied=['EACCES','EPERM'].includes(error.code)||/access is denied|permission denied|\bEACCES\b|\bEPERM\b/i.test(error.message);}
 if(!engine){add('Docker engine','warn',denied?'This process cannot access Docker. The engine may already be running; check Runtime in the running Studio app or use your own terminal.':'This process could not reach Docker. If Docker Desktop is already running, check Runtime in the running Studio app or use your own terminal. Otherwise start Docker Desktop and wait for its Linux engine.');return {ready:false,checks};}
 if(engine.Os!=='linux'){add('Docker engine','warn','Linux containers are required. Switch Docker Desktop to its Linux engine.');return {ready:false,checks};}
 add('Docker engine','pass','Linux engine is reachable.');
 const image=config.sandboxImage||'agentdock-builder:local';
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,180}$/.test(image)){add('Trusted image','warn','Configured image name is invalid.');return {ready:false,checks};}
 let labels;try{const result=await execute(['image','inspect','--format','{{json .Config.Labels}}',image],{timeout:5000});if(result.code===0)labels=JSON.parse(result.output)||{};}catch{}
 if(!labels){add('Trusted image','warn','Image is unavailable. Run npm run sandbox:prepare once; this downloads the trusted dependencies.');return {ready:false,checks};}
 if(labels['agentdock.runtime.protocol']!=='3'||labels['agentdock.python.protocol']!=='1'){add('Trusted image','warn','Image needs rebuilding for Node/Python support. Run npm run sandbox:prepare, then retry.');return {ready:false,checks};}
 add('Trusted image','pass','Image has the expected live-runtime protocol label.');
 add('Execution verification','info','These checks inspect configuration only. Build and test a project to verify actual execution.');
 return {ready:nodeOK,checks};
}
