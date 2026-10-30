// Packages the real frontend into a file that can be opened without a server.
// It enters explicitly labelled browser-only mode; server features stay disabled.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFile(path.join(root,'dist',name),'utf8');
const [core,environments,templates,pythonTemplates,verificationUI,workspaceTools,studio,css,extension]=await Promise.all([read('core.mjs'),read('environments.mjs'),read('templates.mjs'),read('python-templates.mjs'),read('verification-ui.mjs'),read('workspace-tools.mjs'),read('studio.mjs'),read('studio.css'),read('extension.css')]);
// Only remove the leading ESM import block. Imports inside generated Python/Node
// template strings are application source and must survive bundling unchanged.
const flatten=source=>{const lines=source.split(/\r?\n/);while(lines[0]?.startsWith('import '))lines.shift();return lines.join('\n').replace(/^export /gm,'');};
const js=([core,environments,templates,pythonTemplates,verificationUI,workspaceTools,studio].map(flatten).join('\n')).replace(/<\/script/gi,'<\\/script');
const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentDock / Browser-only preview</title><style>'+css+'\n'+extension+'</style></head><body><div id="app"></div><div id="toast" role="status"></div><dialog id="modal"></dialog><script type="module">'+js+'</script></body></html>';
await writeFile(path.join(root,'preview.html'),html);console.log('Built preview.html from the actual frontend. No credentials or backend data included.');
