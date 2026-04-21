const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Load .env if present
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch (_) {}

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_KEY || '';
const SB_URL = process.env.SB_URL || 'https://esogrnjilzxcmvgpieib.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

const SYSTEM_PROMPT = `You are the Agent Hub Assistant — the friendly AI for a 10-agent development team at Double-A Digital. Answer questions about what agents are building.

OWNER: Arjun — building websites and apps

ACTIVE PROJECTS:
- Biryani Temptations: Indian catering site. Adding Clover payments via Supabase Edge Functions.
- SowmithCuts: Barber booking site. Live at sowmithcuts.netlify.app.
- Agent Hub: This dashboard — Groq AI + Supabase realtime.

10 AGENTS:
🧠 Architect — Plans everything. Designed the Clover payment architecture. ACTIVE.
🎨 Frontend Lead — Building Clover Payments.js checkout form. ACTIVE.
🖌️ Frontend Support — UI components, image optimization. IDLE.
⚙️ Backend Agent — Building Supabase Edge Function 'charge-order'. ACTIVE.
📧 Email & Comms — Order confirmation emails via SendGrid. IDLE.
🚀 GitHub DevOps — CI/CD pipelines, auto-deploys. IDLE.
🧪 Tester — Running 47 Playwright E2E tests. ACTIVE.
🔍 Reviewer — OWASP security audit on payment code. ACTIVE.
🔧 Fixer — Fixed API 340ms→80ms today. Investigating checkout bug. WORKING.
💡 Innovator — Researching AR menu previews and loyalty programs. ACTIVE.

TECH STACK: HTML/CSS/JS, Supabase, Clover Payments.js, SendGrid, Ruflo MCP, Groq (Llama 3).

Be friendly, concise (2-4 sentences), use emojis occasionally. You are talking to the developer/owner Arjun.`;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function httpsPost(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve([]); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPatch(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = https.request({
      hostname, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const sbHost = 'esogrnjilzxcmvgpieib.supabase.co';
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=representation' };

async function groqChat(messages) {
  return httpsPost('api.groq.com', '/openai/v1/chat/completions', {
    Authorization: `Bearer ${GROQ_KEY}`
  }, { model: 'llama-3.1-8b-instant', messages, max_tokens: 400, temperature: 0.7 });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── POST /api/chat ──────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const { message, history = [] } = await parseBody(req);
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-6),
        { role: 'user', content: message }
      ];
      const result = await groqChat(messages);
      const reply = result?.choices?.[0]?.message?.content || 'Sorry, I had trouble responding. Try again!';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Connection error — make sure the server is running.' }));
    }
    return;
  }

  // ── GET /api/activity ───────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/activity') {
    try {
      const data = await httpsGet(sbHost, '/rest/v1/agent_activity?order=created_at.desc&limit=60', sbHeaders);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // ── POST /api/activity ──────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/activity') {
    try {
      const body = await parseBody(req);
      const data = await httpsPost(sbHost, '/rest/v1/agent_activity', sbHeaders, body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(500); res.end('{}');
    }
    return;
  }

  // ── GET /api/tasks ──────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    try {
      const data = await httpsGet(sbHost, '/rest/v1/agent_tasks?order=created_at.asc', sbHeaders);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // ── POST /api/tasks ─────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    try {
      const body = await parseBody(req);
      const data = await httpsPost(sbHost, '/rest/v1/agent_tasks', sbHeaders, body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(500); res.end('{}');
    }
    return;
  }

  // ── PATCH /api/tasks ────────────────────────────────────
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/tasks/')) {
    try {
      const id = url.pathname.split('/api/tasks/')[1];
      const body = await parseBody(req);
      const data = await httpsPatch(sbHost, `/rest/v1/agent_tasks?id=eq.${id}`, sbHeaders, body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(500); res.end('{}');
    }
    return;
  }

  // ── Static files ────────────────────────────────────────
  const safePath = url.pathname.replace(/\.\./g, '');
  const filePath = path.join(__dirname, safePath === '/' ? 'index.html' : safePath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`\n  🤖 Agent Hub → http://localhost:${PORT}\n`));
