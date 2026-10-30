import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApplication} from '../server.mjs';
export async function fixture(t,extra={}){
 const testRoot=path.dirname(fileURLToPath(import.meta.url));const dir=await mkdtemp(path.join(testRoot,'tmp-'));
 const config={dataDir:dir,port:4199,registration:'open',enableBuilds:false,enableServers:false,aiKey:'',aiModel:'',aiBase:'https://fake.invalid/v1',provider:'openai',dailyLimit:30000,totalDailyLimit:60000,maxOutput:512,githubToken:'',githubRepo:'',netlifyToken:'',netlifySite:'',...extra.config};
 const app=await createApplication({config,transport:extra.transport,executeDocker:extra.executeDocker,runtimeClock:extra.runtimeClock});
 t.after(async()=>{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(testRoot)+path.sep+'tmp-'));await rm(dir,{recursive:true,force:true});});
 const call=(route,{method='GET',body,cookie='',origin='http://127.0.0.1:4199',host='127.0.0.1:4199'}={})=>new Promise(resolve=>{
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=route;req.method=method;req.headers={host,origin,cookie,'content-type':'application/json'};
  const res={headers:{},status:0,writeHead(status,headers={}){this.status=status;this.headers=headers;},end(value){const buffer=Buffer.from(value||'');let data;try{data=JSON.parse(buffer.toString());}catch{data=buffer.toString();}resolve({status:this.status,headers:this.headers,buffer,data});}};
  app.handler(req,res);
 });
 const register=async(name='builder')=>{const r=await call('/api/auth/register',{method:'POST',body:{username:name,password:'fixture-password-only'}});assert.equal(r.status,200,JSON.stringify(r.data));return {user:r.data.user,cookie:r.headers['Set-Cookie'].split(';')[0]};};
 return {app,call,register,dir};
}
export const workspace=files=>({projects:[{id:'project-1',name:'Fixture project',files,updated:Date.now(),checkpoints:[]}],active:'project-1',history:[],components:[],settings:{dailyLimit:12000,outputLimit:512}});
