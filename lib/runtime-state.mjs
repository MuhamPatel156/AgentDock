import path from 'node:path';
import {mkdir,writeFile,readFile,readdir,lstat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const jobName=/^agentdock-job-[a-f0-9]{24}$/;
export function runtimeOwner(dataDir){
 const absolute=path.resolve(dataDir);
 return createHash('sha256').update(process.platform==='win32'?absolute.toLowerCase():absolute).digest('hex');
}
function folderFor(dataDir,name){
 if(!jobName.test(name))throw Error('Invalid runtime job directory.');
 const base=path.resolve(dataDir,'live'),folder=path.resolve(base,name);
 if(path.dirname(folder)!==base)throw Error('Runtime job escaped its storage directory.');
 return {base,folder};
}
async function rejectLink(target){try{const stat=await lstat(target);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Runtime storage must be an ordinary directory.');}catch(error){if(error.code!=='ENOENT')throw error;}}
export async function writeRuntimeRecord(dataDir,session){
 const {base,folder}=folderFor(dataDir,session.name);await rejectLink(base);await mkdir(base,{recursive:true});await rejectLink(folder);await mkdir(folder,{recursive:true});
 const record={version:1,owner:runtimeOwner(dataDir),name:session.name,pid:process.pid,userId:session.userId,projectId:session.projectId,sourceHash:session.sourceHash,created:session.created,expires:session.expires};
 await writeFile(path.join(folder,'runtime.json'),JSON.stringify(record),{flag:'wx'});
}
export async function readRuntimeRecords(dataDir){
 const base=path.resolve(dataDir,'live');await rejectLink(base);let entries;
 try{entries=await readdir(base,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return [];throw error;}
 if(entries.length>200)throw Error('Too many runtime staging folders. Review storage before starting another backend.');
 const records=[];
 for(const entry of entries){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!jobName.test(entry.name))continue;
  const {folder}=folderFor(dataDir,entry.name),file=path.join(folder,'runtime.json');let record;
  try{const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)continue;record=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)continue;throw error;}
  if(!record||typeof record!=='object'||record.version!==1||record.owner!==runtimeOwner(dataDir)||record.name!==entry.name||!Number.isSafeInteger(record.pid)||record.pid<=0||typeof record.userId!=='string'||!record.userId||record.userId.length>80||typeof record.projectId!=='string'||record.projectId.length>80||! /^[a-f0-9]{64}$/.test(record.sourceHash)||!Number.isSafeInteger(record.created)||!Number.isSafeInteger(record.expires)||record.expires<=record.created||record.expires-record.created>900000)continue;
  records.push({...record,folder});
 }
 return records;
}
export async function removeRuntimeFolder(dataDir,name){
 const {base,folder}=folderFor(dataDir,name);await rejectLink(base);await rejectLink(folder);
 // Recheck the absolute target immediately before recursive deletion.
 if(path.dirname(path.resolve(folder))!==path.resolve(dataDir,'live'))throw Error('Invalid cleanup target.');
 await rm(folder,{recursive:true,force:true});
}
export function processExists(pid){try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}
