import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, workspace} from './helpers.mjs';
import {starter} from '../dist/core.mjs';

test('terminal endpoint rejects empty and dangerous compound commands', async t => {
 const {call, register} = await fixture(t);
 const user = await register('term-user');

 // Reject empty
 const empty = await call('/api/terminal/run', {
  method: 'POST',
  cookie: user.cookie,
  body: {cmd: ''}
 });
 assert.equal(empty.status, 400);

 // Reject dangerous injection
 const dangerous = await call('/api/terminal/run', {
  method: 'POST',
  cookie: user.cookie,
  body: {cmd: 'cat file.txt; rm -rf /'}
 });
 assert.equal(dangerous.status, 400);
 assert.match(dangerous.data.error, /Compound commands/);

 // Accept safe sandboxed command
 const safe = await call('/api/terminal/run', {
  method: 'POST',
  cookie: user.cookie,
  body: {cmd: 'python test.py'}
 });
 assert.equal(safe.status, 200);
 assert.equal(safe.data.exitCode, 0);
});

test('runtime stdin endpoint accepts input for running sessions', async t => {
 const {call, register} = await fixture(t);
 const user = await register('stdin-user');

 const res = await call('/api/runtime/stdin', {
  method: 'POST',
  cookie: user.cookie,
  body: {sessionId: 'sess-1', input: 'hello\n'}
 });
 assert.equal(res.status, 200);
 assert.equal(res.data.ok, true);
});
