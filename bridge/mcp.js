import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { WebSocket } from 'ws';

const token = fs.readFileSync(path.join(os.homedir(), '.usebrowse', 'pairing-code'), 'utf8').trim();
const endpoint = process.env.USEBROWSE_WS || 'ws://127.0.0.1:18791/mcp';
const tools = [
  { name: 'get_page', description: 'Read the active page text, links and form controls.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_tabs', description: 'List tabs in the current browser window.', inputSchema: { type: 'object', properties: {} } },
  { name: 'navigate', description: 'Navigate the active tab to an http or https URL.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'click', description: 'Click an element using a selector or its snapshot index.', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'fill', description: 'Fill a text field using a selector or its snapshot index.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } },
  { name: 'scroll', description: 'Scroll the active page.', inputSchema: { type: 'object', properties: { pixels: { type: 'integer' } } } },
  { name: 'go_back', description: 'Go back in the active tab.', inputSchema: { type: 'object', properties: {} } },
  { name: 'go_forward', description: 'Go forward in the active tab.', inputSchema: { type: 'object', properties: {} } },
  { name: 'reload', description: 'Reload the active page.', inputSchema: { type: 'object', properties: {} } },
];
const safe = new Set(['get_page', 'list_tabs', 'scroll']);
let browser;
let nextId = 0;
const pending = new Map();
let initialized = false;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function write(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function connect() {
  browser = new WebSocket(endpoint);
  browser.on('open', () => browser.send(JSON.stringify({ type: 'hello', token })));
  browser.on('message', (raw) => {
    let message; try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'mcp.result') { const item = pending.get(message.id); if (item) { pending.delete(message.id); item.resolve(message); } }
    if (message.type === 'agent.event' && message.event === 'approval') {
      // MCP callers do not get a browser UI event stream. Pending approval is resolved from the extension side panel.
    }
  });
  browser.on('close', () => setTimeout(connect, 1500));
}
connect();
function browserCall(name, args) {
  if (!browser || browser.readyState !== WebSocket.OPEN) throw new Error('Usebrowse bridge is offline. Start `npm start` and pair the extension.');
  const id = `mcp-${++nextId}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser call timed out.')); }, 45000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject });
    browser.send(JSON.stringify({ type: 'mcp.request', id, name, args }));
  });
}

async function handle(message) {
  const { id, method, params = {} } = message;
  if (!initialized && method !== 'initialize' && method !== 'notifications/initialized') return error(id, -32002, 'Server not initialized');
  if (method === 'initialize') {
    initialized = true;
    return result(id, { protocolVersion: params.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'usebrowse', version: '0.1.0' } });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return result(id, {});
  if (method === 'tools/list') return result(id, { tools });
  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    if (!tools.some((tool) => tool.name === name)) return error(id, -32602, `Unknown tool: ${name}`);
    try {
      const response = await browserCall(name, args);
      return result(id, { content: [{ type: 'text', text: JSON.stringify(response.data ?? response.error) }], isError: !response.ok });
    } catch (err) { return result(id, { isError: true, content: [{ type: 'text', text: err.message }] }); }
  }
  if (id !== undefined) return error(id, -32601, `Method not found: ${method}`);
}
function result(id, value) { return { jsonrpc: '2.0', id, result: value }; }
function error(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    const response = await handle(message);
    if (response) write(response);
  } catch (err) { write(error(null, -32603, err.message)); }
});
