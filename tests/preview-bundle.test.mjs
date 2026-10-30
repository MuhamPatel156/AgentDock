import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {assistantTemplate,reactTemplate} from '../dist/templates.mjs';
import {pythonTemplate,reactPythonTemplate} from '../dist/python-templates.mjs';
test('browser-only bundle preserves complete Node and Python backend template imports',async()=>{
 const html=await readFile(new URL('../preview.html',import.meta.url),'utf8'),match=html.match(/<script type="module">([\s\S]*)<\/script>/);assert.ok(match);
 let source=match[1];assert.match(source,/boot\(\);\s*$/);source=source.replace(/boot\(\);\s*$/,'');source+='\nglobalThis.templateExports={assistantTemplate,reactTemplate,pythonTemplate,reactPythonTemplate};';
 const context={crypto:{randomUUID},addEventListener(){}};vm.runInNewContext(source,context,{timeout:1000});
 const clone=value=>JSON.parse(JSON.stringify(value));assert.deepEqual(clone(context.templateExports.assistantTemplate()),assistantTemplate());assert.deepEqual(clone(context.templateExports.reactTemplate()),reactTemplate());
 for(const flavor of ['stdlib','flask','fastapi','script'])assert.deepEqual(clone(context.templateExports.pythonTemplate(flavor)),pythonTemplate(flavor));assert.deepEqual(clone(context.templateExports.reactPythonTemplate()),reactPythonTemplate());
});
