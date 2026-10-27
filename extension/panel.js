const $ = (id) => document.getElementById(id);
const messages = $('messages'), form = $('composer'), promptBox = $('prompt');
let pendingApproval = null;

function addMessage(text, kind) {
  if (messages.querySelector('.welcome')) messages.innerHTML = '';
  const node = document.createElement('div'); node.className = `message ${kind}`; node.textContent = text; messages.append(node); messages.scrollTop = messages.scrollHeight; return node;
}
function addStep(text, waiting = false) { const node = document.createElement('div'); node.className = `step${waiting ? ' waiting' : ''}`; node.textContent = text; messages.append(node); messages.scrollTop = messages.scrollHeight; return node; }
function status(online) { $('status').textContent = online ? 'BRIDGE ONLINE' : 'BRIDGE OFFLINE'; $('status').classList.toggle('online', online); }

chrome.runtime.sendMessage({ type: 'panel-status' }, (result) => status(!!result?.connected));
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'bridge-status') status(message.status === 'online');
  if (message.type === 'agent.event') {
    if (message.event === 'step') addStep(message.text);
    if (message.event === 'approval') {
      pendingApproval = message.id; $('approvalText').textContent = message.description; $('approval').classList.remove('hidden');
    }
    if (message.event === 'answer') { addMessage(message.text, 'agent'); $('send').disabled = false; }
    if (message.event === 'error') { addMessage(`I hit a problem: ${message.text}`, 'agent'); $('send').disabled = false; }
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault(); const text = promptBox.value.trim(); if (!text) return;
  addMessage(text, 'user'); promptBox.value = ''; $('send').disabled = true;
  try {
    const response = await fetch('http://127.0.0.1:18791/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json(); if (data.answer) addMessage(data.answer, 'agent');
  } catch (error) { addMessage(`Bridge error: ${error.message}. Start it with npm start.`, 'agent'); }
  $('send').disabled = false;
});

document.querySelectorAll('.suggestions button').forEach((button) => button.addEventListener('click', () => { promptBox.value = button.textContent === 'Summarize this page' ? 'Summarize the current page.' : 'What is the main action on this page?'; form.requestSubmit(); }));
$('pair').addEventListener('click', () => { const token = $('token').value.trim(); if (!token) return; chrome.runtime.sendMessage({ type: 'panel-pair', token }, (result) => { status(!!result?.ok); $('pair').textContent = result?.ok ? 'Paired' : 'Retry'; }); });
$('approve').addEventListener('click', () => decide(true)); $('deny').addEventListener('click', () => decide(false));
function decide(approved) { if (!pendingApproval) return; chrome.runtime.sendMessage({ type: 'panel-action', action: 'approval', args: { id: pendingApproval, approved } }); pendingApproval = null; $('approval').classList.add('hidden'); }
