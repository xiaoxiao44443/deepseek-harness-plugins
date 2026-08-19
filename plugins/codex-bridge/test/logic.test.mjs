import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bearerToken,
  codeModeToolArguments,
  isRecent,
  normalizeConfig,
  publicToolSchemas,
  selectAgent,
} from '../lib/logic.js';

test('bridge is enabled by default', () => {
  assert.deepEqual(normalizeConfig({}), { enabled: true });
  assert.deepEqual(normalizeConfig({ enabled: false }), { enabled: false });
});

test('bearer token parser rejects malformed headers', () => {
  assert.equal(bearerToken('Basic abc'), undefined);
  assert.equal(bearerToken('Bearer   '), undefined);
  assert.equal(bearerToken('Bearer secret'), 'secret');
});

test('agent selection honors explicit id then recent activity', () => {
  const first = { id: 'a', status: 'idle' };
  const second = { id: 'b', status: 'idle' };
  const agents = [first, second];
  assert.equal(selectAgent(agents, new Map([['a', 20], ['b', 10]]), 'b'), second);
  assert.equal(selectAgent(agents, new Map([['a', 20], ['b', 10]])), first);
});

test('recent connection detection', () => {
  assert.equal(isRecent(9_000, 10_000), true);
  assert.equal(isRecent(-30_001, 0), false);
});

test('public tool list hides the code-mode transport', () => {
  const native = { name: 'read_file' };
  assert.deepEqual(publicToolSchemas([native, { name: 'run_code' }]), [native]);
});

test('code-mode bridge emits language-correct one-tool programs', () => {
  assert.deepEqual(
    codeModeToolArguments('read-file', { path: 'a.ts', enabled: true }, { name: 'run_code', description: 'Execute a TypeScript program.' }),
    {
      code: 'return await tools["read-file"]({"path":"a.ts","enabled":true});',
      description: 'Run read-file for Codex',
    },
  );
  const python = codeModeToolArguments('read_file', { value: null }, { name: 'run_code', description: 'Execute a Python program.' });
  assert.equal(python.code, 'return await tools["read_file"](__import__("json").loads("{\\"value\\":null}"));');
});
