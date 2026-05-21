#!/usr/bin/env node
// FAR_NZY debug log server
// Usage: node debug-server.js
// View: open http://localhost:8765 in your phone's browser
// App:  add VITE_DEBUG_URL=http://localhost:8765 to apps/web/.env.local then rebuild

const http = require('http');

const logs = [];
const sseClients = new Set();

const COLORS = { log: '#e8d5a3', warn: '#ffaa00', error: '#ff4444' };

function broadcast(entry) {
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  sseClients.forEach(res => { try { res.write(data); } catch { sseClients.delete(res); } });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://localhost');

  // POST /log — receive a log entry from the app
  if (req.method === 'POST' && url.pathname === '/log') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const entry = { ts: Date.now(), level: 'log', message: '', ...JSON.parse(body) };
        logs.push(entry);
        if (logs.length > 1000) logs.shift();
        broadcast(entry);
        const tag = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[0m';
        process.stdout.write(`${tag}[${entry.level.toUpperCase()}]\x1b[0m ${entry.message}\n`);
      } catch {}
      res.writeHead(200); res.end();
    });
    return;
  }

  // GET /log — return all stored logs as JSON
  if (req.method === 'GET' && url.pathname === '/log') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs));
  }

  // DELETE /logs — clear log buffer
  if (req.method === 'DELETE' && url.pathname === '/logs') {
    logs.length = 0;
    sseClients.forEach(c => { try { c.write(`data: ${JSON.stringify({ clear: true })}\n\n`); } catch {} });
    res.writeHead(200); return res.end();
  }

  // GET /events — SSE stream for live updates
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // GET / — dashboard HTML
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FAR_NZY Debug</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#050008;color:#e8d5a3;font-family:'Courier New',monospace;font-size:12px;display:flex;flex-direction:column;height:100vh}
header{background:#0a0012;padding:10px 14px;border-bottom:1px solid rgba(255,0,204,0.25);display:flex;align-items:center;gap:14px;flex-shrink:0}
h1{font-size:13px;color:#ff00cc;letter-spacing:4px;text-shadow:0 0 12px rgba(255,0,204,0.6)}
#conn{font-size:10px;color:#00ffff;letter-spacing:1px}
.actions{margin-left:auto;display:flex;gap:8px}
button{background:transparent;border:1px solid rgba(255,0,204,0.35);color:#ff00cc;padding:3px 10px;cursor:pointer;font-family:monospace;font-size:10px;border-radius:2px;letter-spacing:1px}
button:hover{background:rgba(255,0,204,0.08)}
#filter{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8d5a3;padding:3px 8px;font-family:monospace;font-size:10px;border-radius:2px;width:160px}
#logs{flex:1;overflow-y:auto;padding:6px}
.entry{padding:3px 8px;border-radius:2px;display:flex;gap:10px;align-items:baseline;border-left:2px solid transparent}
.entry.log{border-color:rgba(232,213,163,0.15)}
.entry.warn{color:#ffaa00;background:rgba(255,170,0,0.04);border-color:#ffaa00}
.entry.error{color:#ff5555;background:rgba(255,68,68,0.07);border-color:#ff4444}
.ts{color:rgba(255,255,255,0.18);font-size:9px;min-width:88px;flex-shrink:0}
.lvl{min-width:38px;font-size:9px;letter-spacing:1px;text-transform:uppercase;flex-shrink:0}
.msg{flex:1;white-space:pre-wrap;word-break:break-all;line-height:1.5}
#count{font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px}
.hidden{display:none!important}
</style>
</head>
<body>
<header>
  <h1>FAR_NZY DEBUG</h1>
  <span id="conn">● CONNECTING</span>
  <input id="filter" type="text" placeholder="filter..." oninput="applyFilter()">
  <span id="count">0 entries</span>
  <div class="actions">
    <button onclick="scrollBottom()">↓ BOTTOM</button>
    <button onclick="clearLogs()">CLEAR</button>
  </div>
</header>
<div id="logs"></div>
<script>
const logsEl = document.getElementById('logs');
const connEl = document.getElementById('conn');
const countEl = document.getElementById('count');
const filterEl = document.getElementById('filter');
let total = 0;

function fmt(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0,8)+'.'+String(d.getMilliseconds()).padStart(3,'0');
}

function addEntry(e, prepend) {
  if (e.clear) { logsEl.innerHTML = ''; total = 0; countEl.textContent = '0 entries'; return; }
  total++;
  countEl.textContent = total + ' entr' + (total===1?'y':'ies');
  const el = document.createElement('div');
  el.className = 'entry ' + (e.level||'log');
  el.innerHTML =
    '<span class="ts">'  + fmt(e.ts) + '</span>' +
    '<span class="lvl">' + (e.level||'log') + '</span>' +
    '<span class="msg">' + (e.message||'').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>';
  const q = filterEl.value.toLowerCase();
  if (q && !(e.message||'').toLowerCase().includes(q) && !(e.level||'').includes(q)) el.classList.add('hidden');
  if (prepend) logsEl.prepend(el); else logsEl.appendChild(el);
}

function applyFilter() {
  const q = filterEl.value.toLowerCase();
  logsEl.querySelectorAll('.entry').forEach(el => {
    const msg = el.querySelector('.msg').textContent.toLowerCase();
    const lvl = el.querySelector('.lvl').textContent.toLowerCase();
    el.classList.toggle('hidden', !!q && !msg.includes(q) && !lvl.includes(q));
  });
}

function scrollBottom() { logsEl.scrollTop = logsEl.scrollHeight; }
function clearLogs() { fetch('/logs',{method:'DELETE'}); }

// Load history
fetch('/log').then(r=>r.json()).then(arr=>{arr.forEach(e=>addEntry(e,false));scrollBottom();}).catch(()=>{});

// Live stream
const es = new EventSource('/events');
es.onopen = () => { connEl.textContent='● LIVE'; connEl.style.color='#00ff88'; };
es.onerror = () => { connEl.textContent='● DISCONNECTED'; connEl.style.color='#ff4444'; };
es.onmessage = e => {
  try {
    addEntry(JSON.parse(e.data), false);
    const atBottom = logsEl.scrollHeight - logsEl.scrollTop - logsEl.clientHeight < 80;
    if (atBottom) scrollBottom();
  } catch {}
};
</script>
</body>
</html>`);
});

server.listen(8765, '0.0.0.0', () => {
  console.log('\x1b[35mFAR_NZY debug server\x1b[0m → \x1b[36mhttp://localhost:8765\x1b[0m');
  console.log('App config: add \x1b[33mVITE_DEBUG_URL=http://localhost:8765\x1b[0m to apps/web/.env.local');
});
