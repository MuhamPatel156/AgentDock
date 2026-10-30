import {validateFiles} from '../dist/core.mjs';
import {projectLanguage,pythonRequirements,PYTHON_PACKAGES,NODE_PACKAGES,nodeDependencies} from '../dist/environments.mjs';
import {runtimeDefinition} from './runtime-definition.mjs';

export function inspectEnvironment(input){
 const files=validateFiles(input),language=projectLanguage(files),checks=[],add=(name,status,message)=>checks.push({name,status,message});let runtime=null,dependencies=[];
 if(language==='static')add('Project profile','pass','Static HTML/CSS/JavaScript preview. No backend interpreter is required.');
 else try{runtime=runtimeDefinition(files);add('Runtime definition','pass',runtime.language+' / '+runtime.kind+' / '+runtime.entry+(runtime.build?' / React build first':''));}catch(error){add('Runtime definition','warn',error.message);}
 if(Object.keys(files).some(f=>f.endsWith('.py'))){try{dependencies=pythonRequirements(files);add('Python requirements','pass',dependencies.length+' curated package declarations. No per-project pip install is run.');}catch(error){add('Python requirements','warn',error.message);}add('Python execution','info','Prepare the trusted image once. Syntax, unittest, pytest, script and web jobs run in isolated Linux containers.');if(files['pyproject.toml'])add('pyproject.toml','info','Editable source metadata. Dependencies and scripts from this file are not installed or executed automatically.');}
 if(language==='node'&&files['package.json']){try{const nd=nodeDependencies(files);add('Node dependencies','pass',nd.length+' reviewed package declarations ('+Object.keys(NODE_PACKAGES).join(', ')+').');}catch(error){add('Node dependencies','warn',error.message);}}
 add('Resource limits','info','No external network or published ports; read-only source, 512 MB RAM, one CPU, bounded temporary storage and output. Jobs expire after 90 seconds; live backends at most 15 minutes.');
 return {language,runtime,dependencies,pythonCatalog:PYTHON_PACKAGES,nodeCatalog:NODE_PACKAGES,checks};
}
