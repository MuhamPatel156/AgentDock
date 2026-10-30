import {encryptSecret,decryptSecret,maskSecret} from './secrets.mjs';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {validatePath} from '../dist/core.mjs';
import {runMigrations, getMigrationStatus} from './migrations.mjs';
import {verifyRecoveryKey} from './security.mjs';
import {existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import path from 'node:path';

const scrypt=promisify(scryptCallback);
const hash=s=>createHash('sha256').update(s).digest('hex');

export class Store{
 constructor(filename){
  this.db=new DatabaseSync(filename);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
  runMigrations(this.db);
 }
 countUsers(){return this.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;}
 publicUser(u){return u?{id:u.id,username:u.username,admin:Boolean(u.admin)}:null;}
 async register(username,password){
  if(typeof username!=='string'||! /^[a-zA-Z0-9_-]{3,32}$/.test(username))throw Error('Username must contain 3-32 letters, numbers, underscores or hyphens.');
  if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Use a password of 12-128 characters.');
  if(this.countUsers()>=100)throw Error('This local instance supports up to 100 accounts.');
  if(this.db.prepare('SELECT id FROM users WHERE username=?').get(username.toLowerCase()))throw Error('Username unavailable.');
  const salt=randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64);const id=randomUUID();
  this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,username.toLowerCase(),salt+':'+derived.toString('hex'),this.countUsers()===0?1:0,Date.now());
  return this.publicUser(this.db.prepare('SELECT * FROM users WHERE id=?').get(id));
 }
 async login(username,password){
  if(typeof password!=='string'||password.length>128)throw Error('Invalid credentials.');
  const u=this.db.prepare('SELECT * FROM users WHERE username=?').get(String(username).toLowerCase());
  const [salt,key]=(u?.password||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');const actual=await scrypt(password,salt,64);
  if(!u||!timingSafeEqual(actual,Buffer.from(key,'hex')))throw Error('Invalid credentials.');return this.publicUser(u);
 }
 createSession(id){const token=randomBytes(32).toString('hex');this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+7*86400000);return token;}
 session(token){if(!token)return null;return this.publicUser(this.db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(hash(token),Date.now()));}
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token||''));}
 revokeAllSessions(userId){return this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId).changes;}
 listSessions(userId){return this.db.prepare('SELECT token, expires FROM sessions WHERE user_id=? AND expires>?').all(userId,Date.now());}
 createPasswordReset(username){
  const u=this.db.prepare('SELECT id FROM users WHERE username=?').get(String(username).toLowerCase());
  if(!u)throw Error('User not found.');
  const resetToken=randomBytes(24).toString('hex');
  const expires=Date.now()+900000;
  this.db.prepare('INSERT INTO password_resets VALUES(?,?,?,0)').run(hash(resetToken),u.id,expires);
  return {resetToken,expires};
 }
 async resetPassword(resetToken,newPassword){
  if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)throw Error('Use a password of 12-128 characters.');
  const reset=this.db.prepare('SELECT * FROM password_resets WHERE token=? AND expires>? AND used=0').get(hash(resetToken),Date.now());
  if(!reset)throw Error('Invalid or expired password reset token.');
  this.db.prepare('UPDATE password_resets SET used=1 WHERE token=?').run(hash(resetToken));
  const salt=randomBytes(16).toString('hex'),derived=await scrypt(newPassword,salt,64);
  this.db.prepare('UPDATE users SET password=? WHERE id=?').run(salt+':'+derived.toString('hex'),reset.user_id);
  this.revokeAllSessions(reset.user_id);
  return {ok:true,userId:reset.user_id};
 }
 setRecoveryKey(userId,keyHash){
  this.db.prepare('INSERT INTO recovery_keys VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET key_hash=excluded.key_hash,created=excluded.created').run(userId,keyHash,Date.now());
 }
 getRecoveryKeyHash(userId){
  return this.db.prepare('SELECT key_hash FROM recovery_keys WHERE user_id=?').get(userId)?.key_hash||null;
 }
 async resetPasswordWithRecovery(username,recoveryKey,newPassword){
  if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)throw Error('Use a password of 12-128 characters.');
  const u=this.db.prepare('SELECT * FROM users WHERE username=?').get(String(username).toLowerCase());
  if(!u)throw Error('Invalid credentials.');
  const storedHash=this.getRecoveryKeyHash(u.id);
  if(!storedHash)throw Error('No recovery key configured for this account.');
  const valid=await verifyRecoveryKey(recoveryKey,storedHash);
  if(!valid)throw Error('Invalid recovery key.');
  const salt=randomBytes(16).toString('hex'),derived=await scrypt(newPassword,salt,64);
  this.db.prepare('UPDATE users SET password=? WHERE id=?').run(salt+':'+derived.toString('hex'),u.id);
  this.revokeAllSessions(u.id);
  return {ok:true,user:this.publicUser(u)};
 }
 workspace(user){const r=this.db.prepare('SELECT * FROM workspaces WHERE user_id=?').get(user);return r?{revision:r.revision,state:JSON.parse(r.data)}:{revision:0,state:null};}
 saveWorkspace(user,revision,state){
  const data=JSON.stringify(state);if(Buffer.byteLength(data)>12000000)throw Error('Workspace storage limit is 12 MB. Export older projects.');
  this.db.exec('BEGIN IMMEDIATE');try{const current=this.workspace(user);if(current.revision!==revision){const e=Error('Workspace changed in another tab. Download your backup, then reload before saving.');e.status=409;throw e;}
   this.db.prepare('INSERT INTO workspaces VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(user,revision+1,data);this.db.exec('COMMIT');return revision+1;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 components(){return this.db.prepare('SELECT c.*,u.username FROM components c JOIN users u ON u.id=c.user_id WHERE published=1 ORDER BY created DESC LIMIT 300').all().map(c=>({...JSON.parse(c.data),id:c.id,author:c.username,owner:c.user_id,shared:true,local:false}));}
 publish(user,data){if(this.db.prepare('SELECT COUNT(*) n FROM components WHERE user_id=? AND published=1').get(user).n>=30)throw Error('Maximum 30 published components per account.');const id=randomUUID();this.db.prepare('INSERT INTO components VALUES(?,?,?,?,?)').run(id,user,JSON.stringify(data),1,Date.now());return id;}
 unpublish(user,id,admin){const c=this.db.prepare('SELECT * FROM components WHERE id=?').get(id);if(!c||(!admin&&c.user_id!==user))throw Error('Component unavailable.');this.db.prepare('UPDATE components SET published=0 WHERE id=?').run(id);}
 release(user,name,files){if(this.db.prepare('SELECT COUNT(*) n FROM releases WHERE user_id=?').get(user).n>=100)throw Error('Release limit reached.');const id=randomBytes(24).toString('hex');this.db.prepare('INSERT INTO releases VALUES(?,?,?,?,?,1)').run(id,user,name,JSON.stringify(files),Date.now());return id;}
 releases(user){return this.db.prepare('SELECT id,name,created,active FROM releases WHERE user_id=? ORDER BY created DESC').all(user);}
 getRelease(id){const r=this.db.prepare('SELECT * FROM releases WHERE id=? AND active=1').get(id);return r?{...r,files:JSON.parse(r.files)}:null;}
 setRelease(user,id,active){const r=this.db.prepare('UPDATE releases SET active=? WHERE id=? AND user_id=?').run(active?1:0,id,user);if(!r.changes)throw Error('Release unavailable.');}
 aiPaused(){return this.db.prepare("SELECT value FROM settings WHERE key='ai-paused'").get()?.value==='true';}
 setAIPaused(paused){if(typeof paused!=='boolean')throw Error('Paused must be true or false.');this.db.prepare("INSERT INTO settings VALUES('ai-paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(paused));}
 usage(user){const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);return {day,month,used:this.db.prepare('SELECT reserved FROM usage WHERE day=? AND user_id=?').get(day,user)?.reserved||0,total:this.db.prepare('SELECT COALESCE(SUM(reserved),0) n FROM usage WHERE day=?').get(day).n,monthlyUsed:this.db.prepare('SELECT COALESCE(SUM(reserved),0) n FROM usage WHERE substr(day,1,7)=? AND user_id=?').get(month,user).n,monthlyTotal:this.db.prepare('SELECT COALESCE(SUM(reserved),0) n FROM usage WHERE substr(day,1,7)=?').get(month).n};}
 reserve(user,amount,userLimit,totalLimit,monthlyLimit=Infinity,totalMonthlyLimit=Infinity){if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Invalid token reservation.');this.db.exec('BEGIN IMMEDIATE');try{const u=this.usage(user);if(u.used+amount>userLimit||u.total+amount>totalLimit){const e=Error('Daily token allowance would be exceeded. No API request was made.');e.status=429;throw e;}if(u.monthlyUsed+amount>monthlyLimit||u.monthlyTotal+amount>totalMonthlyLimit){const e=Error('Monthly token allowance would be exceeded. No API request was made.');e.status=429;throw e;}this.db.prepare('INSERT INTO usage VALUES(?,?,?) ON CONFLICT(day,user_id) DO UPDATE SET reserved=reserved+excluded.reserved').run(u.day,user,amount);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
 run(user,kind,status,details){this.db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run(randomUUID(),user,kind,status,JSON.stringify(details),Date.now());this.db.prepare('DELETE FROM runs WHERE user_id=? AND id NOT IN (SELECT id FROM runs WHERE user_id=? ORDER BY created DESC LIMIT 500)').run(user,user);}
 runs(user){return this.db.prepare('SELECT * FROM runs WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 100').all(user).map(r=>({...r,details:JSON.parse(r.details)}));}
 saveVerification(user,report){
  this.db.prepare('INSERT INTO verification_reports VALUES(?,?,?,?,?)').run(report.id,user,report.projectId,JSON.stringify(report),report.created);
  this.db.prepare('DELETE FROM verification_reports WHERE user_id=? AND project_id=? AND id NOT IN (SELECT id FROM verification_reports WHERE user_id=? AND project_id=? ORDER BY created DESC,rowid DESC LIMIT 20)').run(user,report.projectId,user,report.projectId);
  this.db.prepare('DELETE FROM verification_reports WHERE user_id=? AND id NOT IN (SELECT id FROM verification_reports WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 100)').run(user,user);
 }
 verifications(user,projectId){return this.db.prepare('SELECT data FROM verification_reports WHERE user_id=? AND project_id=? ORDER BY created DESC,rowid DESC LIMIT 20').all(user,projectId).map(r=>JSON.parse(r.data));}
 verification(user,id){const row=this.db.prepare('SELECT data FROM verification_reports WHERE id=? AND user_id=?').get(id,user);if(!row){const error=Error('Verification report unavailable.');error.status=404;throw error;}return JSON.parse(row.data);}
 updateVerification(user,report){const r=this.db.prepare('UPDATE verification_reports SET data=? WHERE id=? AND user_id=?').run(JSON.stringify(report),report.id,user);if(!r.changes){const e=Error('Verification report unavailable.');e.status=404;throw e;}}

 // Migrations
 migrationStatus(){return getMigrationStatus(this.db);}
 runPendingMigrations(){return runMigrations(this.db);}

 // Secrets
 setProjectSecret(userId,projectId,key,value,masterPassword){
  if(!key||typeof key!=='string'||! /^[A-Z0-9_]{1,64}$/.test(key))throw Error('Secret key must be 1-64 uppercase letters, numbers or underscores (e.g. API_KEY).');
  const enc=encryptSecret(value,masterPassword),now=Date.now();
  this.db.prepare('INSERT INTO project_secrets VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,project_id,key) DO UPDATE SET encrypted_value=excluded.encrypted_value,iv=excluded.iv,tag=excluded.tag,updated=excluded.updated').run(randomUUID(),userId,projectId,key,enc.ciphertext,enc.iv,enc.tag,now,now);
  return {key,masked:maskSecret(value),updated:now};
 }
 getProjectSecret(userId,projectId,key,masterPassword){
  const row=this.db.prepare('SELECT * FROM project_secrets WHERE user_id=? AND project_id=? AND key=?').get(userId,projectId,key);
  if(!row)return null;
  return decryptSecret(row.encrypted_value,masterPassword,row.iv,row.tag);
 }
 listProjectSecrets(userId,projectId){
  return this.db.prepare('SELECT key,created,updated FROM project_secrets WHERE user_id=? AND project_id=? ORDER BY key ASC').all(userId,projectId);
 }
 deleteProjectSecret(userId,projectId,key){
  return this.db.prepare('DELETE FROM project_secrets WHERE user_id=? AND project_id=? AND key=?').run(userId,projectId,key).changes>0;
 }
 rotateProjectSecret(userId,projectId,key,newValue,masterPassword){
  return this.setProjectSecret(userId,projectId,key,newValue,masterPassword);
 }

 // Project Databases
 createProjectDatabase(userId,projectId,name){
  if(!name||typeof name!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(name))throw Error('Database name must be 1-64 alphanumeric characters, underscores or hyphens.');
  const id=randomUUID(),now=Date.now(),filename=`${name}.sqlite`;
  this.db.prepare('INSERT INTO project_databases VALUES(?,?,?,?,?,?,?)').run(id,userId,projectId,name,filename,now,now);
  return {id,name,filename,created:now};
 }
 listProjectDatabases(userId,projectId){
  return this.db.prepare('SELECT id,name,filename,created,updated FROM project_databases WHERE user_id=? AND project_id=? ORDER BY name ASC').all(userId,projectId);
 }
 getProjectDatabase(userId,projectId,name){
  return this.db.prepare('SELECT id,name,filename,created,updated FROM project_databases WHERE user_id=? AND project_id=? AND name=?').get(userId,projectId,name)||null;
 }
 deleteProjectDatabase(userId,projectId,name,dataDir){
  const meta=this.getProjectDatabase(userId,projectId,name);
  if(!meta)return false;
  if(dataDir){
   const dbPath=path.join(dataDir,'projects',userId,projectId,'dbs',meta.filename);
   try{unlinkSync(dbPath);}catch{}
  }
  return this.db.prepare('DELETE FROM project_databases WHERE user_id=? AND project_id=? AND name=?').run(userId,projectId,name).changes>0;
 }
 executeProjectDatabase(userId,projectId,name,sql,params=[],dataDir){
  const dbMeta=this.getProjectDatabase(userId,projectId,name);
  if(!dbMeta)throw Error('Project database unavailable.');
  if(typeof sql!=='string'||!sql.trim())throw Error('SQL query string required.');
  const dbPath=path.join(dataDir,'projects',userId,projectId,'dbs',dbMeta.filename);
  mkdirSync(path.dirname(dbPath),{recursive:true});
  const projectDb=new DatabaseSync(dbPath);
  try{
   const trimmed=sql.trim();
   if(trimmed.toUpperCase().startsWith('SELECT')||trimmed.toUpperCase().startsWith('PRAGMA')||trimmed.toUpperCase().startsWith('EXPLAIN')){
    const stmt=projectDb.prepare(trimmed);
    return {rows:stmt.all(...params),changes:0};
   }else{
    projectDb.exec('BEGIN IMMEDIATE');
    projectDb.exec(trimmed);
    projectDb.exec('COMMIT');
    this.db.prepare('UPDATE project_databases SET updated=? WHERE id=?').run(Date.now(),dbMeta.id);
    return {rows:[],changes:1};
   }
  }catch(err){
   try{projectDb.exec('ROLLBACK');}catch{}
   throw err;
  }finally{
   projectDb.close();
  }
 }
 inspectProjectDatabase(userId,projectId,name,dataDir){
  const dbMeta=this.getProjectDatabase(userId,projectId,name);
  if(!dbMeta)throw Error('Project database unavailable.');
  const dbPath=path.join(dataDir,'projects',userId,projectId,'dbs',dbMeta.filename);
  if(!existsSync(dbPath))return {tables:[]};
  const projectDb=new DatabaseSync(dbPath);
  try{
   const tables=projectDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
   return {tables};
  }finally{
   projectDb.close();
  }
 }

 // Persistent Project Files
 saveProjectFile(userId,projectId,relPath,content,dataDir){
  const clean=validatePath(relPath);
  const full=path.resolve(dataDir,'projects',userId,projectId,'files',clean);
  const base=path.resolve(dataDir,'projects',userId,projectId,'files');
  if(!full.startsWith(base+path.sep)&&full!==base)throw Error('Invalid project file path.');
  mkdirSync(path.dirname(full),{recursive:true});
  const buf=Buffer.isBuffer(content)?content:Buffer.from(content,'utf8');
  if(buf.length>10000000)throw Error('Persistent project file size limit is 10 MB.');
  writeFileSync(full,buf);
  const sha256=createHash('sha256').update(buf).digest('hex'),now=Date.now(),id=randomUUID();
  this.db.prepare('INSERT INTO project_files VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,project_id,path) DO UPDATE SET size=excluded.size,sha256=excluded.sha256,updated=excluded.updated').run(id,userId,projectId,clean,buf.length,sha256,now,now);
  return {path:clean,size:buf.length,sha256,updated:now};
 }
 listProjectFiles(userId,projectId){
  return this.db.prepare('SELECT path,size,sha256,updated FROM project_files WHERE user_id=? AND project_id=? ORDER BY path ASC').all(userId,projectId);
 }
 getProjectFile(userId,projectId,relPath,dataDir){
  const clean=validatePath(relPath);
  const full=path.resolve(dataDir,'projects',userId,projectId,'files',clean);
  if(!existsSync(full))return null;
  return readFileSync(full);
 }
 deleteProjectFile(userId,projectId,relPath,dataDir){
  const clean=validatePath(relPath);
  const full=path.resolve(dataDir,'projects',userId,projectId,'files',clean);
  try{unlinkSync(full);}catch{}
  return this.db.prepare('DELETE FROM project_files WHERE user_id=? AND project_id=? AND path=?').run(userId,projectId,clean).changes>0;
 }

 // Instance Backups
 recordBackup(id,userId,filename,size,sha256,migrationVersion){
  this.db.prepare('INSERT INTO instance_backups VALUES(?,?,?,?,?,?,?)').run(id,userId,filename,size,sha256,migrationVersion,Date.now());
 }
 listBackups(userId){
  return this.db.prepare('SELECT id,filename,size,sha256,migration_version,created FROM instance_backups WHERE user_id=? ORDER BY created DESC LIMIT 50').all(userId);
 }
 getBackup(userId,id){
  return this.db.prepare('SELECT id,filename,size,sha256,migration_version,created FROM instance_backups WHERE user_id=? AND id=?').get(userId,id)||null;
 }
 // GitHub Accounts & Project Repos
 setGitHubAccount(userId, githubUser, token, scopes, masterPassword){
  const enc=encryptSecret(token, masterPassword), now=Date.now(), id=randomUUID();
  this.db.prepare('INSERT INTO github_accounts VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,github_user) DO UPDATE SET encrypted_token=excluded.encrypted_token,iv=excluded.iv,tag=excluded.tag,scopes=excluded.scopes,updated=excluded.updated').run(id,userId,githubUser,enc.ciphertext,enc.iv,enc.tag,scopes,now,now);
  return {githubUser,scopes,updated:now};
 }
 getGitHubAccount(userId, masterPassword){
  const row=this.db.prepare('SELECT * FROM github_accounts WHERE user_id=?').get(userId);
  if(!row)return null;
  const token=masterPassword?decryptSecret(row.encrypted_token,masterPassword,row.iv,row.tag):null;
  return {githubUser:row.github_user,scopes:row.scopes,token,created:row.created,updated:row.updated};
 }
 deleteGitHubAccount(userId){
  return this.db.prepare('DELETE FROM github_accounts WHERE user_id=?').run(userId).changes>0;
 }
 setProjectRepo(userId, projectId, repository, branch='main', verified=0){
  const id=randomUUID(), now=Date.now();
  this.db.prepare('INSERT INTO project_repos VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,project_id) DO UPDATE SET repository=excluded.repository,branch=excluded.branch,verified=excluded.verified').run(id,userId,projectId,repository,branch,verified?1:0,now);
  return {projectId,repository,branch,verified:Boolean(verified)};
 }
 getProjectRepo(userId, projectId){
  const r=this.db.prepare('SELECT repository,branch,verified FROM project_repos WHERE user_id=? AND project_id=?').get(userId,projectId);
  return r?{repository:r.repository,branch:r.branch,verified:Boolean(r.verified)}:null;
 }
 addCustomDomain(userId, projectId, domain){
  const clean=domain.trim().toLowerCase();
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(clean))throw Error('Invalid domain format.');
  const id=randomUUID(), now=Date.now();
  this.db.prepare('INSERT INTO custom_domains VALUES(?,?,?,?,1,?)').run(id,userId,projectId,clean,now);
  return {domain:clean,verified:true,created:now};
 }
 listCustomDomains(userId, projectId){
  return this.db.prepare('SELECT domain,verified,created FROM custom_domains WHERE user_id=? AND project_id=?').all(userId,projectId);
 }
 deleteCustomDomain(userId, projectId, domain){
  return this.db.prepare('DELETE FROM custom_domains WHERE user_id=? AND project_id=? AND domain=?').run(userId,projectId,domain.trim().toLowerCase()).changes>0;
 }
 close(){this.db.close();}
}
