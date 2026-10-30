import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,workspace} from './helpers.mjs';
import {starter} from '../dist/core.mjs';
import {Store} from '../lib/store.mjs';
import path from 'node:path';
test('accounts use private sessions and protect workspace routes',async t=>{
 const {call,register,app}=await fixture(t);assert.equal((await call('/api/bootstrap')).data.setupRequired,true);assert.equal((await call('/api/workspace')).status,401);
 const owner=await register();assert.equal(owner.user.admin,true);assert.equal(owner.user.password,undefined);
 const stored=app.store.db.prepare('SELECT password FROM users WHERE id=?').get(owner.user.id).password;assert.ok(!stored.includes('fixture-password-only'));assert.ok(stored.includes(':'));
 const login=await call('/api/auth/login',{method:'POST',body:{username:'builder',password:'fixture-password-only'}});assert.equal(login.status,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
 assert.equal((await call('/api/auth/login',{method:'POST',body:{username:'builder',password:'incorrect'}})).status,400);
 await call('/api/auth/logout',{method:'POST',cookie:owner.cookie,body:{}});assert.equal((await call('/api/workspace',{cookie:owner.cookie})).status,401);
});
test('origin and host checks reject cross-site writes before processing them',async t=>{
 const {call}=await fixture(t);assert.equal((await call('/api/bootstrap',{host:'attacker.example:4199'})).status,403);assert.equal((await call('/api/auth/register',{method:'POST',origin:'null',body:{}})).status,403);assert.equal((await call('/api/auth/register',{method:'POST',origin:'',body:{}})).status,403);
});
test('workspaces persist with revisions and do not leak between accounts',async t=>{
 const {call,register}=await fixture(t);const a=await register('alice'),b=await register('bob');const state=workspace(starter());const put=await call('/api/workspace',{method:'PUT',cookie:a.cookie,body:{revision:0,state}});assert.equal(put.data.revision,1);
 assert.equal((await call('/api/workspace',{cookie:a.cookie})).data.state.projects[0].name,'Fixture project');assert.equal((await call('/api/workspace',{cookie:b.cookie})).data.state,null);
 assert.equal((await call('/api/workspace',{method:'PUT',cookie:a.cookie,body:{revision:0,state}})).status,409);
});
test('components require publication consent and protect author operations',async t=>{
 const {call,register}=await fixture(t);const a=await register('owner'),b=await register('author'),c=await register('reader');const component={name:'A card',html:'<section>Card</section>',css:'section { color: green; }',license:'MIT'};
 assert.equal((await call('/api/community',{method:'POST',cookie:b.cookie,body:{component}})).status,400);
 const pub=await call('/api/community',{method:'POST',cookie:b.cookie,body:{component,confirm:true}});assert.equal(pub.status,200);
 assert.equal((await call('/api/community',{method:'POST',cookie:b.cookie,body:{component:{...component,html:'<p>sk-abcdefghijklmnopqrstuvwxyz</p>'},confirm:true}})).status,400);
 const items=(await call('/api/community',{cookie:c.cookie})).data.components;assert.equal(items[0].author,'author');
 assert.equal((await call('/api/community/'+pub.data.id+'/unpublish',{method:'POST',cookie:c.cookie,body:{}})).status,400);
 assert.equal((await call('/api/community/'+pub.data.id+'/unpublish',{method:'POST',cookie:a.cookie,body:{}})).status,200);assert.equal((await call('/api/community',{cookie:c.cookie})).data.components.length,0);
});
test('preview snapshots and local releases isolate code and retain immutable source',async t=>{
 const {call,register}=await fixture(t);const a=await register();const files=starter();const preview=await call('/api/preview',{method:'POST',cookie:a.cookie,body:{files}});assert.equal(preview.status,200);
 const page=await call(preview.data.url);assert.equal(page.status,200);assert.match(page.headers['Content-Security-Policy'],/sandbox allow-scripts/);assert.match(page.headers['Content-Security-Policy'],/connect-src 'none'/);assert.ok(page.data.includes(preview.data.nonce));assert.match(page.data,/<script[^>]+src="app.js"[^>]+crossorigin="anonymous"/);
 const scriptURL=preview.data.url.replace(/index\.html$/,'app.js');assert.equal((await call(scriptURL,{origin:'null'})).status,200);assert.equal((await call(scriptURL,{origin:'https://untrusted.example'})).status,403);assert.equal((await call('/api/workspace',{cookie:a.cookie,origin:'null'})).status,403);assert.equal((await call('/studio.mjs',{origin:'null'})).status,403);
 const release=await call('/api/releases',{method:'POST',cookie:a.cookie,body:{files,name:'Version one',confirm:true}});assert.equal(release.status,200);files['index.html']='changed';assert.ok((await call(release.data.url)).data.includes('My first application'));
 await call('/api/releases/'+release.data.id+'/toggle',{method:'POST',cookie:a.cookie,body:{active:false}});assert.equal((await call(release.data.url)).status,404);
 await call('/api/releases/'+release.data.id+'/toggle',{method:'POST',cookie:a.cookie,body:{active:true}});assert.equal((await call(release.data.url)).status,200);
});
test('ZIP and laptop exports include nested files while secret paths are rejected',async t=>{
 const {call,register,dir}=await fixture(t);const a=await register();const files={...starter(),'components/card.js':'export const card = 1;'};
 const zip=await call('/api/zip',{method:'POST',cookie:a.cookie,body:{files}});assert.equal(zip.status,200);assert.equal(zip.buffer.readUInt32LE(0),0x04034b50);assert.ok(zip.buffer.includes(Buffer.from('components/card.js')));
 const folder=await call('/api/export-folder',{method:'POST',cookie:a.cookie,body:{files}});assert.equal(folder.status,200);assert.ok(folder.data.path.startsWith(dir));
 assert.equal((await call('/api/export-folder',{method:'POST',cookie:a.cookie,body:{files:{...files,'../escape.js':'no'}}})).status,400);
 assert.equal((await call('/.env')).status,404);assert.equal((await call('/api/status',{cookie:a.cookie})).data.aiKey,undefined);
});
test('server syntax checks parse source without executing application code',async t=>{
 const {call,register}=await fixture(t);const a=await register();const files={...starter(),'app.js':'throw new Error("Must never execute");','components/broken.js':'const = ;'};
 const result=await call('/api/checks',{method:'POST',cookie:a.cookie,body:{files}});assert.equal(result.status,200);assert.equal(result.data.checks.find(c=>c.name==='app.js syntax').status,'pass');const broken=result.data.checks.find(c=>c.name==='components/broken.js syntax');assert.equal(broken.status,'warn');assert.match(broken.message,/SyntaxError/);assert.ok(!broken.message.includes('node:internal'));
});
test('a second SQLite connection reads saved accounts and workspace data from disk',async t=>{const {call,register,dir}=await fixture(t);const a=await register();await call('/api/workspace',{method:'PUT',cookie:a.cookie,body:{revision:0,state:workspace(starter())}});const reopened=new Store(path.join(dir,'studio.sqlite'));try{assert.equal(reopened.countUsers(),1);assert.equal(reopened.workspace(a.user.id).revision,1);assert.equal(reopened.workspace(a.user.id).state.projects[0].name,'Fixture project');}finally{reopened.close();}});
