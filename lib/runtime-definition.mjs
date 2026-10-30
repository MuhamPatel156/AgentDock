import {validatePath} from '../dist/core.mjs';
import {projectLanguage,pythonRequirements} from '../dist/environments.mjs';
export function runtimeDefinition(files){
 let data={};try{data=JSON.parse(files['agentdock.runtime.json']||'{}');}catch{throw Error('agentdock.runtime.json must contain valid JSON.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Runtime configuration must be a JSON object.');
 const language=data.language||(projectLanguage(files)==='python'?'python':'node');if(!['node','python'].includes(language))throw Error('Choose node or python as the runtime language.');
 const entry=validatePath(data.entry||(language==='python'?(files['app.py']!==undefined?'app.py':'main.py'):'server.mjs')),port=data.port??3000,kind=data.kind||'web';
 if(!(language==='python'?/\.py$/:/\.(js|mjs)$/).test(entry)||!(entry in files))throw Error('Runtime entry must be an existing source file for the selected language.');
 if(!['web','script'].includes(kind))throw Error('Runtime kind must be web or script.');
 if(language==='python')pythonRequirements(files);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Runtime port must be between 1024 and 65535.');
 if(data.build!==undefined&&typeof data.build!=='boolean')throw Error('Runtime build must be true or false.');
 return {entry,port,language,kind,build:data.build??Object.keys(files).some(f=>/\.(jsx|tsx)$/.test(f))};
}
