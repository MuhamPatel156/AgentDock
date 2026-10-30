// A bounded HTTP exchange over Docker exec/stdin. No published container ports.
import http from 'node:http';
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>100000)throw Error('Broker request too large.');}
try{
 const data=JSON.parse(input),port=Number(process.env.PORT);
 if(!Number.isInteger(port)||port<1024||port>65535||typeof data.path!=='string'||!data.path.startsWith('/')||data.path.startsWith('//')||data.path.length>2000||/[\r\n]/.test(data.path))throw Error('Invalid broker target.');
 if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(data.method))throw Error('Unsupported method.');
 const body=Buffer.from(data.body||'','base64');if(body.length>65536)throw Error('Request body limit.');
 const headers={};for(const key of ['content-type','accept'])if(typeof data.headers?.[key]==='string')headers[key]=data.headers[key].slice(0,200);
 if(body.length)headers['content-length']=body.length;
 await new Promise(resolve=>{
  let settled=false;const finish=(data,code=0)=>{if(settled)return;settled=true;process.stdout.write(JSON.stringify(data));process.exitCode=code;resolve();};
  const request=http.request({hostname:'127.0.0.1',port,path:data.path,method:data.method,headers,timeout:5000},response=>{
   const chunks=[];let bytes=0;response.on('data',chunk=>{bytes+=chunk.length;if(bytes>1000000){response.destroy(Error('Response body limit.'));return;}chunks.push(chunk);});
   response.on('end',()=>finish({status:response.statusCode,headers:{'content-type':response.headers['content-type']||'application/octet-stream',...(response.headers.location?{location:response.headers.location}:{})},body:Buffer.concat(chunks).toString('base64')}));
   response.on('error',error=>finish({error:error.message},1));
  });request.on('timeout',()=>request.destroy(Error('Backend response timed out.')));request.on('error',error=>finish({error:error.message},1));request.end(body);
 });
}catch(error){process.stdout.write(JSON.stringify({error:error.message}));process.exitCode=1;}
