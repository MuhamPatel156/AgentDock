import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const helper=fileURLToPath(new URL('../sandbox/request.mjs',import.meta.url));
async function server(t,handler){const app=http.createServer(handler);await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>app.close(resolve)));return app.address().port;}
function exchange(port,data){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[helper],{windowsHide:true,env:{PORT:String(port)},stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.once('error',reject);child.once('close',code=>{try{resolve({code,data:JSON.parse(out),err});}catch(error){reject(Error('Invalid helper output: '+error.message));}});child.stdin.end(JSON.stringify(data));});}
test('real broker subprocess forwards HTTP bodies without cookies or authorization',async t=>{
 let captured;const port=await server(t,async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);captured={headers:req.headers,body:Buffer.concat(chunks).toString(),path:req.url,method:req.method};res.writeHead(201,{'content-type':'application/json','set-cookie':'ignored=1'});res.end('{"saved":true}');});
 const result=await exchange(port,{method:'POST',path:'/api/items?q=1',headers:{'content-type':'application/json',cookie:'studio-session',authorization:'private'},body:Buffer.from('{"item":1}').toString('base64')});
 assert.equal(result.code,0);assert.equal(result.data.status,201);assert.equal(captured.body,'{"item":1}');assert.equal(captured.path,'/api/items?q=1');assert.equal(captured.method,'POST');assert.equal(captured.headers.cookie,undefined);assert.equal(captured.headers.authorization,undefined);assert.equal(result.data.headers['set-cookie'],undefined);assert.deepEqual(JSON.parse(Buffer.from(result.data.body,'base64')),{saved:true});
});
test('real broker rejects responses larger than one megabyte',async t=>{const port=await server(t,(_req,res)=>res.end(Buffer.alloc(1000001,65)));const result=await exchange(port,{method:'GET',path:'/',headers:{},body:''});assert.equal(result.code,1);assert.match(result.data.error,/Response body limit/);});
test('real broker rejects external targets before opening a connection',async()=>{for(const path of ['https://external.example/','//external.example/','/bad\r\nheader']){const result=await exchange(3000,{method:'GET',path,headers:{},body:''});assert.equal(result.code,1);assert.match(result.data.error,/Invalid broker target/);}});
