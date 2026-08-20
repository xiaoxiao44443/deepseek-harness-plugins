import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';

const SERVER_PATH = fileURLToPath(new URL(
  '../codex-marketplace/plugins/dfy-dsh/server.mjs',
  import.meta.url,
));
const MCP_CONFIG_PATH = fileURLToPath(new URL(
  '../codex-marketplace/plugins/dfy-dsh/.mcp.json',
  import.meta.url,
));

test('Codex MCP config uses the cross-platform Node launcher', async () => {
  const config = JSON.parse(await readFile(MCP_CONFIG_PATH, 'utf8'));
  assert.deepEqual(config.mcpServers.dfy_dsh, {
    command: 'node',
    args: ['./server.mjs'],
    cwd: '.',
    enabled: true,
    startup_timeout_sec: 10,
    tool_timeout_sec: 3600,
  });
});

function createMcpClient(child) {
  let input = '';
  let nextId = 0;
  const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    input += chunk;
    while (true) {
      const newline = input.indexOf('\n');
      if (newline < 0) return;
      const line = input.slice(0, newline).trim();
      input = input.slice(newline + 1);
      if (line.length === 0) continue;
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (waiter === undefined) continue;
      pending.delete(message.id);
      waiter.resolve(message);
    }
  });
  return {
    request(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (error) => {
          if (error === null || error === undefined) return;
          pending.delete(id);
          reject(error);
        });
      });
    },
  };
}

test('static tool fallback lists and calls session tools through the authenticated bridge', async () => {
  const requests = [];
  const token = 'test-token';
  const bridge = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(request);
    let result;
    if (request.method === 'tools.list') {
      result = {
        tools: [{
          name: 'browser_execute',
          description: 'Run the built-in browser.',
          parameters: {
            type: 'object',
            properties: { code: { type: 'string' } },
            required: ['code'],
            additionalProperties: false,
          },
        }],
      };
    } else if (request.method === 'tools.call') {
      result = {
        content: [{ type: 'text', text: JSON.stringify({ called: request.params }) }],
      };
    } else if (request.method === 'runs.send') {
      result = { runId: 'run-test', status: 'queued', cursor: '0:1' };
    } else if (request.method === 'runs.wait') {
      result = { runId: request.params.runId, status: 'running', cursor: '1:2', heartbeat: false };
    } else if (request.method === 'messages.read') {
      result = { sessionId: request.params.sessionId, cursor: 5, events: [] };
    } else {
      result = {};
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result }));
  });
  await new Promise((resolve, reject) => {
    bridge.once('error', reject);
    bridge.listen(0, '127.0.0.1', resolve);
  });

  const temporary = await mkdtemp(join(tmpdir(), 'dsh-codex-bridge-'));
  const discoveryPath = join(temporary, 'endpoint.json');
  const address = bridge.address();
  assert.ok(address && typeof address === 'object');
  await writeFile(discoveryPath, JSON.stringify({
    version: 1,
    origin: `http://127.0.0.1:${address.port}`,
    token,
    pid: process.pid,
  }));

  const child = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, DSH_CODEX_BRIDGE_FILE: discoveryPath },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const client = createMcpClient(child);
  try {
    const listed = await client.request('tools/list');
    assert.equal(listed.error, undefined);
    const tools = listed.result.tools;
    assert.ok(tools.some((tool) => tool.name === 'dsh_list_tools'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_call_tool'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_send_message'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_get_run'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_wait_run'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_cancel_run'));
    assert.ok(tools.some((tool) => tool.name === 'dsh_read_messages'));
    const browserExecute = tools.find((tool) => tool.name === 'browser_execute');
    assert.ok(browserExecute);
    assert.deepEqual(browserExecute.inputSchema.required, ['code']);
    assert.equal(browserExecute.inputSchema.properties.sessionId.type, 'string');

    const liveCatalog = await client.request('tools/call', {
      name: 'dsh_list_tools',
      arguments: { sessionId: 'session-test' },
    });
    assert.equal(liveCatalog.error, undefined);
    assert.deepEqual(JSON.parse(liveCatalog.result.content[0].text), {
      tools: [{
        name: 'browser_execute',
        description: 'Run the built-in browser.',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
          additionalProperties: false,
        },
      }],
    });
    assert.deepEqual(requests.at(-1), {
      method: 'tools.list',
      params: { sessionId: 'session-test' },
    });

    const called = await client.request('tools/call', {
      name: 'dsh_call_tool',
      arguments: {
        name: 'browser_execute',
        arguments: { code: 'return 42' },
        sessionId: 'session-test',
      },
    });
    assert.equal(called.error, undefined);
    assert.deepEqual(JSON.parse(called.result.content[0].text), {
      called: {
        name: 'browser_execute',
        arguments: { code: 'return 42' },
        sessionId: 'session-test',
      },
    });
    assert.deepEqual(requests.at(-1), {
      method: 'tools.call',
      params: {
        name: 'browser_execute',
        arguments: { code: 'return 42' },
        sessionId: 'session-test',
      },
    });

    const sent = await client.request('tools/call', {
      name: 'dsh_send_message',
      arguments: {
        sessionId: 'session-test',
        text: 'hello',
        mode: 'queue',
        clientRequestId: 'request-test',
      },
    });
    assert.equal(sent.error, undefined);
    assert.deepEqual(JSON.parse(sent.result.content[0].text), {
      runId: 'run-test',
      status: 'queued',
      cursor: '0:1',
    });
    assert.deepEqual(requests.at(-1), {
      method: 'runs.send',
      params: {
        sessionId: 'session-test',
        text: 'hello',
        mode: 'queue',
        clientRequestId: 'request-test',
      },
    });

    const waited = await client.request('tools/call', {
      name: 'dsh_wait_run',
      arguments: { runId: 'run-test', cursor: '0:1', timeoutMs: 25 },
    });
    assert.equal(waited.error, undefined);
    assert.deepEqual(requests.at(-1), {
      method: 'runs.wait',
      params: { runId: 'run-test', cursor: '0:1', timeoutMs: 25 },
    });

    const messages = await client.request('tools/call', {
      name: 'dsh_read_messages',
      arguments: { sessionId: 'session-test', cursor: 3, limit: 20 },
    });
    assert.equal(messages.error, undefined);
    assert.deepEqual(requests.at(-1), {
      method: 'messages.read',
      params: { sessionId: 'session-test', cursor: 3, limit: 20 },
    });

    const invalid = await client.request('tools/call', {
      name: 'dsh_call_tool',
      arguments: { name: 'browser_execute', arguments: [] },
    });
    assert.match(invalid.error.message, /arguments must be an object/);
  } finally {
    child.stdin.end();
    child.kill();
    if (child.exitCode === null) await once(child, 'exit');
    await new Promise((resolve) => bridge.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
});
