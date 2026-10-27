const BRIDGE = 'ws://127.0.0.1:18791/browser';
let socket;
let reconnectDelay = 1000;
const pending = new Map();

function connect() {
  chrome.storage.local.get(['pairingToken'], ({ pairingToken }) => {
    if (!pairingToken) { setTimeout(connect, 3000); return; }
    try {
      socket = new WebSocket(BRIDGE);
      socket.onopen = () => { reconnectDelay = 1000; socket.send(JSON.stringify({ type: 'hello', token: pairingToken })); };
      socket.onmessage = async (event) => {
        const request = JSON.parse(event.data);
        if (request.type === 'agent.event') {
          chrome.runtime.sendMessage(request).catch(() => {});
          return;
        }
        if (request.type === 'browser.request') {
          const result = await runBrowserAction(request.action, request.args || {});
          socket.send(JSON.stringify({ type: 'browser.result', id: request.id, ...result }));
        } else if (request.type === 'browser.status') {
          chrome.runtime.sendMessage({ type: 'bridge-status', status: request.status }).catch(() => {});
        }
      };
      socket.onclose = () => { setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay * 2, 15000); };
      socket.onerror = () => socket.close();
    } catch { setTimeout(connect, reconnectDelay); }
  });
}

async function activeTab(id) {
  if (id) {
    const tab = await chrome.tabs.get(Number(id));
    if (!tab?.url?.startsWith('http')) throw new Error('That tab is not an accessible web page.');
    return tab;
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url?.startsWith('http')) throw new Error('Open a normal web page first. Browser internal pages are not available.');
  return tab;
}

async function pageMessage(tabId, type, args = {}) {
  try { return await chrome.tabs.sendMessage(tabId, { type, ...args }); }
  catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tabId, { type, ...args });
  }
}

async function runBrowserAction(action, args) {
  try {
    if (action === 'list_tabs') {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return { ok: true, data: tabs.map(({ id, title, url, active }) => ({ id, title, url, active })) };
    }
    if (action === 'new_tab') {
      let url;
      if (args.url) {
        url = new URL(args.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are allowed.');
      }
      const tab = await chrome.tabs.create({ ...(url ? { url: url.href } : {}), active: true });
      return { ok: true, data: { id: tab.id, url: tab.url || 'new tab' } };
    }
    if (action === 'close_tab') {
      const tab = args.tabId ? await chrome.tabs.get(Number(args.tabId)) : await activeTab();
      await chrome.tabs.remove(tab.id);
      return { ok: true, data: `Closed tab ${tab.id}.` };
    }
    if (action === 'switch_tab') {
      const tab = await chrome.tabs.get(Number(args.tabId));
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
      return { ok: true, data: { id: tab.id, title: tab.title, url: tab.url } };
    }
    if (action === 'wait_for_text') {
      const tab = await activeTab(args.tabId);
      const needle = String(args.text || '').toLocaleLowerCase();
      const timeout = Math.max(500, Math.min(10000, Number(args.timeoutMs) || 5000));
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        const page = await pageMessage(tab.id, 'snapshot');
        if (page?.ok && page.data.text.toLocaleLowerCase().includes(needle)) return { ok: true, data: { found: true, url: page.data.url } };
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      return { ok: true, data: { found: false, waitedMs: timeout } };
    }
    if (action === 'navigate') {
      const url = new URL(args.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are allowed.');
      const tab = await activeTab(args.tabId); await chrome.tabs.update(tab.id, { url: url.href });
      await new Promise((r) => setTimeout(r, 1100));
      return { ok: true, data: { url: url.href } };
    }
    if (action === 'go_back' || action === 'go_forward' || action === 'reload') {
      const tab = await activeTab(args.tabId);
      if (action === 'reload') await chrome.tabs.reload(tab.id);
      else await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (direction) => history.go(direction), args: [action === 'go_back' ? -1 : 1] });
      return { ok: true, data: `${action} completed.` };
    }
    const tab = await activeTab(args.tabId);
    const mapped = { get_page: 'snapshot', click: 'click', fill: 'fill', scroll: 'scroll' }[action];
    if (!mapped) throw new Error('Unknown browser action.');
    const response = await pageMessage(tab.id, mapped, args);
    return response || { ok: false, error: 'The page did not respond.' };
  } catch (error) { return { ok: false, error: error.message }; }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'panel-pair') {
    chrome.storage.local.set({ pairingToken: message.token }, () => { connect(); sendResponse({ ok: true }); });
    return true;
  }
  if (message.type === 'panel-action') {
    if (!socket || socket.readyState !== WebSocket.OPEN) return sendResponse({ ok: false, error: 'Bridge is offline.' });
    socket.send(JSON.stringify({ type: 'panel.action', action: message.action, args: message.args || {} }));
    return sendResponse({ ok: true });
  }
  if (message.type === 'panel-status') sendResponse({ connected: socket?.readyState === WebSocket.OPEN });
});

chrome.action.onClicked.addListener((tab) => chrome.sidePanel.open({ windowId: tab.windowId }));
chrome.runtime.onInstalled.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }));
connect();
