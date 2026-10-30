import {spawn} from 'node:child_process';
import path from 'node:path';
export function protectSecret(value,decrypt=false){
 if(process.platform!=='win32')throw Error('Windows account encryption is available only on Windows. Use local environment variables on other systems.');
 const code=decrypt?'$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }':'$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString $s))';
 const systemRoot=process.env.SystemRoot||'C:\\Windows';
 const executable=path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 // PowerShell 7's inherited module path is incompatible with Windows PS 5.1.
 const env={...process.env,PSModulePath:path.join(systemRoot,'System32','WindowsPowerShell','v1.0','Modules')};
 return new Promise((resolve,reject)=>{const child=spawn(executable,['-NoProfile','-NonInteractive','-Command',code],{env,stdio:['pipe','pipe','pipe'],windowsHide:true});let output='';const timer=setTimeout(()=>{child.kill();reject(Error('Windows credential protection timed out.'));},15000);child.stdout.on('data',d=>output+=d);child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error('Windows credential protection is unavailable.'));});child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error('Unable to protect or unlock credentials with this Windows account.'));else resolve(output);});child.stdin.on('error',()=>{});child.stdin.end(value);});
}
