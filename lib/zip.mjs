import {inflateRawSync} from 'node:zlib';

// Standards-compliant uncompressed and deflate ZIP archive parser/generator; no third-party dependency.
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buf){let c=0xffffffff;for(const x of buf)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function zipFiles(files){
 const locals=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const n=Buffer.from(name),data=Buffer.from(text),crc=crc32(data);const h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
  locals.push(h,n,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+data.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,dir,end]);
}

export function unzipFiles(buf){
 if(!Buffer.isBuffer(buf))buf=Buffer.from(buf);
 const files={};let offset=0;
 while(offset+30<=buf.length){
  const sig=buf.readUInt32LE(offset);
  if(sig!==0x04034b50)break;
  const method=buf.readUInt16LE(offset+8);
  const compSize=buf.readUInt32LE(offset+18);
  const nameLen=buf.readUInt16LE(offset+26);
  const extraLen=buf.readUInt16LE(offset+28);
  const nameStart=offset+30;
  const rawName=buf.toString('utf8',nameStart,nameStart+nameLen);
  const name=rawName.replaceAll('\\','/');
  if(name.includes('..')||name.startsWith('/')||/^[a-zA-Z]:/.test(name))throw Error('Unsafe file path in archive: '+name);
  const dataStart=nameStart+nameLen+extraLen;
  if(dataStart+compSize>buf.length)throw Error('Corrupt ZIP archive: data extends past buffer.');
  const rawData=buf.subarray(dataStart,dataStart+compSize);
  let data;
  if(method===0)data=Buffer.from(rawData);
  else if(method===8)data=inflateRawSync(rawData);
  else throw Error('Unsupported ZIP compression method: '+method);
  files[name]=data;
  offset=dataStart+compSize;
 }
 return files;
}
