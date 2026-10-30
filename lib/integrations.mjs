import {zipFiles} from './zip.mjs';
import {hasSecrets} from './agents.mjs';
function requireAdmin(user){if(!user.admin){const e=Error('Only the local instance owner can use configured integration credentials.');e.status=403;throw e;}}
export function createIntegrations(config,transport=fetch){
 async function github(path,method='GET',body){const r=await transport('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+config.githubToken,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'AgentDock-Studio'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error(`GitHub returned HTTP ${r.status}. No automatic retry; inspect the repository before trying again.`);return r.json();}
 return {
  async push(user,input,files){
   requireAdmin(user);if(!config.githubToken||!config.githubRepo)throw Error('Configure GITHUB_TOKEN and GITHUB_REPOSITORY on the server.');
   if(input.confirm!==true||input.repository!==config.githubRepo)throw Error('Confirm the exact configured GitHub repository before pushing.');
   if(hasSecrets(files))throw Error('Potential credential detected. Export blocked.');
   const branch=config.githubBranch||'main';if(!/^[a-zA-Z0-9._/-]{1,120}$/.test(branch)||branch.includes('..'))throw Error('Invalid configured branch.');
   if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(config.githubRepo))throw Error('Invalid repository configuration.');
   const prefix='/repos/'+config.githubRepo,ref=await github(prefix+'/git/ref/heads/'+branch),head=ref.object.sha;
   const commit=await github(prefix+'/git/commits/'+head);
   const tree=await github(prefix+'/git/trees','POST',{base_tree:commit.tree.sha,tree:Object.entries(files).map(([path,content])=>({path,mode:'100644',type:'blob',content}))});
   const next=await github(prefix+'/git/commits','POST',{message:String(input.message||'Update application from AgentDock').slice(0,200),tree:tree.sha,parents:[head]});
   // A non-fast-forward race fails; never force-push over another user's changes.
   await github(prefix+'/git/refs/heads/'+branch,'PATCH',{sha:next.sha,force:false});
   return {sha:next.sha,url:`https://github.com/${config.githubRepo}/commit/${next.sha}`,branch};
  },
  async deploy(user,input,files){
   requireAdmin(user);if(!config.netlifyToken||!config.netlifySite)throw Error('Configure NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID first.');
   if(input.confirm!==true||input.site!==config.netlifySite)throw Error('Confirm the exact configured Netlify site before publishing.');
   if(hasSecrets(files))throw Error('Potential credential detected. Publishing blocked.');
   const r=await transport('https://api.netlify.com/api/v1/sites/'+encodeURIComponent(config.netlifySite)+'/deploys',{method:'POST',headers:{Authorization:'Bearer '+config.netlifyToken,'Content-Type':'application/zip'},body:zipFiles(files),signal:AbortSignal.timeout(55000),redirect:'error'});
   if(!r.ok)throw Error(`Netlify returned HTTP ${r.status}. No automatic retry; check your Netlify dashboard.`);
   const result=await r.json();return {id:result.id,state:result.state,url:result.deploy_ssl_url||result.ssl_url||result.deploy_url||result.url||null};
  }
 };
}
