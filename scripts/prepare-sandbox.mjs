import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
console.log('Preparing a trusted local build image. This downloads a Node/Python image and pinned npm/Python packages; no LLM requests are made.');
const child=spawn('docker',['build','--tag','agentdock-builder:local',path.join(root,'sandbox')],{stdio:'inherit',windowsHide:true,shell:false});
child.on('error',()=>{console.error('Start Docker Desktop before preparing the sandbox.');process.exitCode=1;});child.on('close',code=>process.exitCode=code||0);
