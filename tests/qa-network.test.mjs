import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('QA guard blocks outbound sockets and fetch before making any connection',()=>{
 const url=new URL('../scripts/qa-network-guard.mjs',import.meta.url).href;
 const script=`import ${JSON.stringify(url)};import net from 'node:net';import assert from 'node:assert/strict';assert.throws(()=>net.connect({host:'example.invalid',port:443}),/disabled/);await assert.rejects(fetch('https://example.invalid'),/disabled/);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{},encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(child.status,0,child.stderr);
});
