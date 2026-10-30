import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {assistantTemplate} from '../dist/templates.mjs';
import {validateFiles} from '../dist/core.mjs';
import {checkProject} from '../lib/agents.mjs';
test('AI assistant template exports a valid client, Azure config, backend and functional checks',async()=>{const files=validateFiles(assistantTemplate());assert.doesNotThrow(()=>new Script(files['app.js']));assert.ok(JSON.parse(files['agent.config.json']).instructions);assert.ok(JSON.parse(files['agentdock.tests.json']).steps.length);assert.ok(files['server.mjs'].includes('process.env.AZURE_API_KEY'));assert.ok(files['server.mjs'].includes(".listen(port,'127.0.0.1'"));const checks=await checkProject(files);assert.ok(checks.filter(c=>c.name.endsWith('syntax')).every(c=>c.status==='pass'),JSON.stringify(checks));});
