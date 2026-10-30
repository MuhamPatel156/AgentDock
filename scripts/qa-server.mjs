// Isolated browser-QA instance. Never loads .env or real provider credentials.
import './qa-network-guard.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=await createApplication({config:{port:4199,dataDir:path.join(root,'.agentdock','browser-qa'),registration:'closed',inviteCode:'',aiKey:'',aiModel:'',aiBase:'',githubToken:'',githubRepo:'',netlifyToken:'',netlifySite:'',enableBuilds:false,enableServers:false},transport:async()=>{throw Error('External service calls are disabled in browser QA.');}});
const username='browserqa',password='Browser-QA-fixture-only-4199';
if(!app.store.db.prepare('SELECT id FROM users WHERE username=?').get(username))await app.store.register(username,password);
app.server.listen(4199,'127.0.0.1',()=>console.log('Isolated QA: http://localhost:4199\nFixture login: browserqa / Browser-QA-fixture-only-4199\nAI and external integrations: OFF. Use localhost here to keep cookies separate from the main 127.0.0.1 workspace.'));
app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'QA port 4199 is already in use.':e.message);process.exitCode=1;app.close();});
const stop=()=>app.server.close(async()=>{await app.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
