import test from 'node:test';
import assert from 'node:assert/strict';
import {starter} from '../dist/core.mjs';
import {createSecureTools, evaluateProposal, resolveModel} from '../lib/agents.mjs';
import {fixture} from './helpers.mjs';

test('model router resolves allowed models and defaults to configured model', () => {
 const config = {aiModel: 'gpt-4.1-mini', provider: 'openai'};
 assert.equal(resolveModel('builder', null, config).model, 'gpt-4.1-mini');
 assert.equal(resolveModel('reviewer', 'gpt-4.1-mini', config).model, 'gpt-4.1-mini');
 assert.throws(() => resolveModel('builder', 'unapproved-dangerous-model', config), /Unsupported model/);
});

test('secure tools enforce project boundaries and reject secrets', async () => {
 const files = {
  ...starter(),
  'data.txt': 'API_KEY=sk-abcdefghijklmnopqrstuvwxyz'
 };
 const tools = createSecureTools(files);

 const list = tools.list_files();
 assert.ok(list.includes('index.html'));
 assert.ok(list.includes('app.js'));

 const read = tools.read_file('index.html');
 assert.ok(read.ok);
 assert.ok(read.content.includes('<!doctype html>'));

 assert.equal(tools.read_file('../etc/passwd').ok, false);

 const secRead = tools.read_file('data.txt');
 assert.equal(secRead.ok, false);
 assert.match(secRead.error, /secret/i);
});

test('evaluations engine evaluates proposal quality, syntax and security', async () => {
 const files = starter();

 const goodProposal = {
  title: 'Add greeting',
  summary: 'Adds a friendly greeting to app.js',
  files: {
   'app.js': 'console.log("Welcome to AgentDock!");'
  }
 };
 const goodEval = await evaluateProposal(goodProposal, files);
 assert.equal(goodEval.ok, true);
 assert.ok(goodEval.score >= 80);
 assert.equal(goodEval.checks.every(c => c.status === 'pass'), true);

 const badProposal = {
  title: 'Bad change',
  summary: 'Introduces a syntax error',
  files: {
   'app.js': 'function broken( {'
  }
 };
 const badEval = await evaluateProposal(badProposal, files);
 assert.equal(badEval.ok, false);
 assert.ok(badEval.checks.some(c => c.name.includes('syntax') && c.status !== 'pass'));
});

test('server exposes agent traces and evaluation endpoints', async t => {
 const {call, register} = await fixture(t);
 const user = await register('agent-eval-user');

 const traces = await call('/api/agent/traces', {cookie: user.cookie});
 assert.equal(traces.status, 200);
 assert.ok(Array.isArray(traces.data.traces));

 const evalRes = await call('/api/agent/evaluate', {
  method: 'POST',
  cookie: user.cookie,
  body: {
   files: starter(),
   proposal: {
    title: 'Test',
    summary: 'Test proposal',
    files: {'app.js': 'console.log("evaluated");'}
   }
  }
 });
 assert.equal(evalRes.status, 200);
 assert.equal(evalRes.data.ok, true);
});
