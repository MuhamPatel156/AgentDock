import test from 'node:test';
import assert from 'node:assert/strict';
import {protectSecret} from '../scripts/windows-secret.mjs';
test('Windows account protection round-trips a dummy key without plaintext storage',{skip:process.platform!=='win32',timeout:20000},async()=>{const fixture='fixture-only-not-a-real-key';const encrypted=await protectSecret(fixture);assert.ok(encrypted.length>100);assert.ok(!encrypted.includes(fixture));assert.equal(await protectSecret(encrypted,true),fixture);});
