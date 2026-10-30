import test from 'node:test';
import assert from 'node:assert/strict';
import {pythonTemplate} from '../dist/python-templates.mjs';
import {projectLanguage, nodeDependencies, NODE_PACKAGES} from '../dist/environments.mjs';
import {inspectEnvironment} from '../lib/environment.mjs';
import {validateFiles} from '../dist/core.mjs';

test('ML & data science notebook template provides valid exportable source and tests', () => {
 const files = pythonTemplate('notebook');
 assert.doesNotThrow(() => validateFiles(files));
 assert.equal(projectLanguage(files), 'python');
 assert.ok(files['main.py']);
 assert.ok(files['data.csv']);
 assert.ok(files['test_main.py']);
 assert.ok(files['index.html']);
});

test('reviewed node dependencies validate packages against catalog', () => {
 const valid = {
  'package.json': JSON.stringify({
   dependencies: {react: '19.3.1', vite: '8.3.5'}
  })
 };
 const deps = nodeDependencies(valid);
 assert.equal(deps.length, 2);
 assert.equal(deps[0].name, 'react');

 const unreviewed = {
  'package.json': JSON.stringify({
   dependencies: {'unreviewed-malicious-pkg': '1.0.0'}
  })
 };
 assert.throws(() => nodeDependencies(unreviewed), /outside the reviewed catalog/);
});

test('environment inspector reports reviewed Node dependencies for node projects', () => {
 const report = inspectEnvironment({
  'index.html': '<!doctype html><title>Node app</title>',
  'server.mjs': 'export default {};',
  'package.json': JSON.stringify({
   dependencies: {react: '19.3.1'}
  })
 });
 assert.equal(report.language, 'node');
 const check = report.checks.find(c => c.name === 'Node dependencies');
 assert.ok(check);
 assert.equal(check.status, 'pass');
});
