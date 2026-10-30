import {createHash,randomUUID} from 'node:crypto';
import {validateFiles} from '../dist/core.mjs';
import {checkProject} from './agents.mjs';
import {projectLanguage,pythonRequirements} from '../dist/environments.mjs';
import {runtimeDefinition} from './runtime-definition.mjs';

export const sourceHash=files=>createHash('sha256').update(JSON.stringify(validateFiles(files))).digest('hex');
const redact=value=>String(value||'').replace(/sk-[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}/g,'[redacted]').slice(0,1000);
function fixture(files,mode){
 const file=mode==='live'?'agentdock.live-tests.json':'agentdock.tests.json';
 try{
  const steps=Object.hasOwn(files,file)?JSON.parse(files[file]).steps:[{action:'exists',selector:'h1'}];
  if(!Array.isArray(steps)||steps.length<1||steps.length>30||steps.some(s=>!s||!['exists','click','text','input','wait-text'].includes(s.action)||typeof s.selector!=='string'||!s.selector||s.selector.length>300||['text','wait-text'].includes(s.action)&&typeof s.contains!=='string'||s.action==='input'&&typeof s.value!=='string'))throw Error('Use 1–30 valid exists/click/text/input/wait-text steps with selectors.');
  return {mode,file,status:'pass',message:files[file]?'Fixture definition is valid.':'No fixture file; default h1 smoke check will be used.',expected:steps.map(s=>s.action+' '+s.selector)};
 }catch{return {mode,file,status:'warn',message:'Invalid fixture JSON or steps. Use 1–30 supported steps with selectors, contains for text, and value for input.',expected:[]};}
}
function executionEvidence(report,runs){
 return [['react-build',report.kind==='react'],['node-test',report.hasNodeTests],...(report.hasPython?[['python-syntax',true],['python-tests',report.hasPythonTests],['python-run',Boolean(report.isPythonScript)]]:[])].map(([mode,required])=>{
  const run=runs.find(r=>r.kind==='container'&&['passed','failed'].includes(r.status)&&r.details.sourceHash===report.sourceHash&&(mode==='python-tests'?['python-test','python-pytest'].includes(r.details.mode):r.details.mode===mode));
  return {mode,required,runner:run?.details.mode||null,status:run?(run.status==='passed'?'pass':'warn'):required?'not-run':'not-required',completed:run?.created||null};
 });
}
export function reportStatus(report){
 if([...report.staticChecks,...report.fixtures,...report.execution].some(c=>c.status==='warn')||report.browser.checks.some(c=>c.status==='warn'))return 'needs-attention';
 if(report.browser.status==='not-run'||report.execution.some(c=>c.required&&c.status!=='pass'))return 'checks-pending';
 return 'checks-passed';
}
export function createVerification({store,check=checkProject,clock=Date.now}){
 const active=new Set();
 const present=(user,report)=>{const result={...report,execution:executionEvidence(report,store.runs(user.id))};return {...result,status:reportStatus(result)};};
 return {
  async create(user,input){
   if(typeof input.projectId!=='string'||!input.projectId||input.projectId.length>80)throw Error('A project ID up to 80 characters is required.');
   if(active.has(user.id)||active.size>=2){const error=Error('Verification is already running. Wait for it to finish.');error.status=409;throw error;}
   const files=validateFiles(input.files);active.add(user.id);
   try{
    const report={schemaVersion:1,id:randomUUID(),projectId:input.projectId,projectName:String(input.projectName||'Project').slice(0,60),created:clock(),sourceHash:sourceHash(files),fileCount:Object.keys(files).length,sourceBytes:Buffer.byteLength(Object.values(files).join('')),kind:Object.keys(files).some(f=>/\.(jsx|tsx)$/.test(f))?'react':files['agent.config.json']?'agent':'static',hasNodeTests:Object.keys(files).some(f=>/\.test\.(js|mjs)$/.test(f)),staticChecks:(await check(files)).map(c=>({name:redact(c.name),status:c.status==='pass'?'pass':'warn',message:c.status==='pass'?'Passed this static check.':redact(c.message)})),fixtures:[fixture(files,'static'),...(files['agentdock.live-tests.json']?[fixture(files,'live')]:[])],browser:{status:'not-run',provenance:'browser-reported',mode:null,completed:null,checks:[]},limitations:['These checks are not production-readiness or security certification.','Browser results are reported by the preview and can be influenced by project code.','No AI request or deployment is performed by verification.']};
    report.language=projectLanguage(files);report.hasPython=Object.keys(files).some(f=>f.endsWith('.py'));report.hasPythonTests=Object.keys(files).some(f=>/(?:^|\/)test_[^/]+\.py$/.test(f));if(report.hasPython){let message='Uses the preinstalled curated Python environment.',status='pass';try{pythonRequirements(files);}catch(error){status='warn';message=error.message;}report.staticChecks.push({name:'Python dependency declarations',status,message});report.limitations.push('Python syntax and tests require explicit isolated Runtime jobs; JavaScript parsing does not validate Python.');}
    if(report.language==='python'&&report.kind==='static')report.kind='python';if(files['agentdock.runtime.json']){try{const definition=runtimeDefinition(files);report.isPythonScript=definition.language==='python'&&definition.kind==='script';report.staticChecks.push({name:'Runtime definition',status:'pass',message:'Runtime entry and configuration validated.'});}catch(error){report.staticChecks.push({name:'Runtime definition',status:'warn',message:redact(error.message)});}}
    store.saveVerification(user.id,report);store.run(user.id,'verification','created',{id:report.id,projectId:report.projectId,sourceHash:report.sourceHash});return present(user,report);
   }finally{active.delete(user.id);}
  },
  list(user,projectId){return store.verifications(user.id,projectId).map(r=>present(user,r));},
  get(user,id){return present(user,store.verification(user.id,id));},
  browser(user,id,input){
   const report=store.verification(user.id,id);
   if(sourceHash(input.files)!==report.sourceHash){const error=Error('Source changed. Create a new verification report.');error.status=409;throw error;}
   const definition=report.fixtures.find(f=>f.mode===input.mode);
   if(!definition||definition.status!=='pass')throw Error('No valid fixture definition for this preview mode.');
   if(!Array.isArray(input.checks)||input.checks.length!==definition.expected.length||input.checks.some((c,i)=>!c||c.name!==definition.expected[i]||!['pass','warn'].includes(c.status)||typeof c.message!=='string'||c.message.length>1000))throw Error('Browser results must match every fixture step in order.');
   report.browser={status:input.checks.every(c=>c.status==='pass')?'pass':'warn',provenance:'browser-reported',mode:input.mode,completed:clock(),checks:input.checks.map(c=>({name:redact(c.name),status:c.status,message:redact(c.message)}))};
   store.updateVerification(user.id,report);return present(user,report);
  }
 };
}
