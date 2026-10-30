import {readdir,lstat,readFile} from 'node:fs/promises';
const files={};let bytes=0;
async function collect(directory,prefix=''){
 for(const name of await readdir(directory)){
  const full=directory+'/'+name,relative=prefix+name,stat=await lstat(full);
  if(stat.isSymbolicLink())throw Error('Symlink in build output.');
  if(stat.isDirectory()){if(relative.split('/').length>8)throw Error('Output nesting limit.');await collect(full,relative+'/');}
  else if(stat.isFile()){bytes+=stat.size;if(bytes>1000000||Object.keys(files).length>=80)throw Error('Compiled output exceeds preview limits.');files[relative]=await readFile(full,'utf8');}
  else throw Error('Unsupported output type.');
 }
}
await collect('/out');
process.stdout.write('\nAGENTDOCK_OUTPUT='+JSON.stringify(files)+'\n');
