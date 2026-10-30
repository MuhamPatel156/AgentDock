// Explicit real-Docker acceptance checks. Never loads .env or provider keys.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env=Object.fromEntries(['PATH','Path','SystemRoot','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','DOCKER_CONFIG','DOCKER_HOST','DOCKER_CONTEXT','AGENTDOCK_SANDBOX_IMAGE'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
console.log('Real Docker acceptance: dedicated test containers; no Azure calls or user project changes. The expiry check takes about one minute. Keep Studio running.');
const child=spawn(process.execPath,['--test','--test-concurrency=1','tests/runtime.live.mjs'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='';const collect=(stream,chunk)=>{stream.write(chunk);if(output.length<100000)output+=chunk.toString();};
child.stdout.on('data',chunk=>collect(process.stdout,chunk));child.stderr.on('data',chunk=>collect(process.stderr,chunk));
child.on('error',()=>{console.error('Unable to start the live runtime tests.');process.exitCode=1;});
child.on('close',async code=>{await mkdir(path.join(root,'outputs'),{recursive:true});await writeFile(path.join(root,'outputs','phase1-live-runtime-results.txt'),output);process.exitCode=code??1;console.log('Saved outputs/phase1-live-runtime-results.txt');});
