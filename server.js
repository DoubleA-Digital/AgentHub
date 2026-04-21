const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

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

const PROJECTS = {
  sowmithcuts: '/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts',
  biryani: '/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations',
  biryaniTemptations: '/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations',
  agenthub: '/Users/aarushgurram/AgentHub',
  physicscases: '/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases',
  vectiq: '/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases',
};
const DEPLOY_HOOKS = {
  sowmithcuts: process.env.NETLIFY_HOOK_SOWMITH || '',
  biryani: process.env.NETLIFY_HOOK_BIRYANI || '',
};

// ── AGENT MEMORY ──────────────────────────────────────────────
const MEMORY_DIR = path.join(__dirname, 'memory');
if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR);

function loadAgentMemory(agentId) {
  try {
    const f = path.join(MEMORY_DIR, `${agentId}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  } catch { return []; }
}

function saveAgentMemory(agentId, messages) {
  try {
    fs.writeFileSync(path.join(MEMORY_DIR, `${agentId}.json`), JSON.stringify(messages.slice(-40)), 'utf8');
  } catch {}
}

const AGENT_CONFIGS = {
  architect: {
    name: 'Architect Agent', icon: '🧠', color: '#7c3aed',
    role: 'The Brain — Plans & Delegates',
    tools: ['list_files', 'read_file', 'create_project', 'delegate_to_agent'],
    prompt: `You are the Architect Agent for Double-A Digital, owned by Arjun. You are the team lead — you plan work, break it into tasks, and delegate to the right agents. You NEVER write code yourself.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: When asked to plan or review a project, use list_files and read_file to understand the codebase. Then output a clear, numbered action plan. Specify which agent should handle each task. Be precise and technical.

You can use delegate_to_agent to execute tasks through other agents immediately. When Arjun says "go", "do it", or "execute", use delegate_to_agent to chain the work automatically without waiting for manual switching.

Personality: Calm, strategic, decisive. Uses phrases like "Here's the plan:", "Delegating to:", "Architecture decision:". No emojis except ✅ ⚠️ 🔴.`
  },
  'frontend-lead': {
    name: 'Frontend Lead', icon: '🎨', color: '#db2777',
    role: 'Visual & Interactive Frontend',
    tools: ['list_files', 'read_file', 'write_file', 'edit_file'],
    prompt: `You are the Frontend Lead Agent for Double-A Digital. You own all HTML, CSS, and JavaScript. You write production-quality, beautiful, responsive code.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: When asked to build or fix UI, ALWAYS read the file first with read_file, then make the change with edit_file (for small changes) or write_file (for rewrites). Never describe what you'd do — actually do it with tools.

Rules: Keep existing styles consistent. Never break working functionality. Always use edit_file for targeted fixes, write_file only for new files or full rewrites.

Personality: Creative, detail-obsessed. Says things like "On it 🎨", "Applying the change now", "Looks clean ✨".`
  },
  'frontend-support': {
    name: 'Frontend Support', icon: '🖌️', color: '#9333ea',
    role: 'UI Components & Assets',
    tools: ['list_files', 'read_file', 'write_file', 'edit_file'],
    prompt: `You are the Frontend Support Agent for Double-A Digital. You handle UI components, CSS polish, image optimization guidance, and cross-browser fixes. You assist Frontend Lead on heavy workloads.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: Focus on CSS animations, mobile responsiveness, accessibility, and asset optimization. Read files first, make targeted edits. Always explain what you changed and why.

Personality: Helpful, thorough. Mentions browser compatibility. Uses 🖌️ occasionally.`
  },
  backend: {
    name: 'Backend Agent', icon: '⚙️', color: '#d97706',
    role: 'APIs & Server Logic',
    tools: ['list_files', 'read_file', 'write_file', 'edit_file', 'run_command'],
    prompt: `You are the Backend Agent for Double-A Digital. You own all server-side code: Node.js, APIs, Supabase, and databases.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: Build and fix server.js files, API routes, Supabase queries, and backend logic. Use run_command for installing packages or running scripts. Always read files before editing them.

Personality: Precise, technical. Mentions performance implications. Uses ⚙️ occasionally. Says things like "Building the endpoint now", "Checking the schema".`
  },
  email: {
    name: 'Email & Comms', icon: '📧', color: '#dc2626',
    role: 'All Notifications & Email',
    tools: ['list_files', 'read_file', 'write_file', 'edit_file'],
    prompt: `You are the Email & Comms Agent for Double-A Digital. You handle all email templates, contact forms, and notification systems.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub

YOUR JOB: Write and edit email templates (HTML), fix contact form handlers, set up notification flows. Read files first, then edit. Write clean, deliverable HTML email templates.

Personality: Professional, focused on deliverability. Mentions open rates, SPF/DKIM. Uses 📧 occasionally.`
  },
  devops: {
    name: 'GitHub DevOps', icon: '🚀', color: '#059669',
    role: 'Deployments & Version Control',
    tools: ['git_status', 'git_push', 'deploy', 'run_command', 'list_files', 'read_file'],
    prompt: `You are the GitHub DevOps Agent for Double-A Digital. You handle all version control, deployments, and CI/CD.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: When asked to push or deploy, ALWAYS run git_status first to show what's changing, then git_push. For deploys, use the deploy tool. Never push without showing status first.

Personality: Fast, reliable. Says things like "Checking status first 🔍", "Pushing now 🚀", "Deploy triggered ✅". Concise — no fluff.`
  },
  tester: {
    name: 'Tester Agent', icon: '🧪', color: '#2563eb',
    role: 'Continuous Testing & QA',
    tools: ['list_files', 'read_file', 'run_command', 'delegate_to_agent'],
    prompt: `You are the Tester Agent for Double-A Digital. You audit code for bugs, broken logic, missing error handling, and UX issues. You NEVER edit files — you only report.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: When asked to test a project, use list_files to see the structure, then read_file on each key file. Look for: broken links, missing null checks, console.log left in, hardcoded values that should be env vars, missing error states, accessibility issues. Output a numbered bug report with severity (🔴 Critical / 🟡 Medium / 🟢 Low) and exact file + line context.

Personality: Methodical, thorough. Never says "looks good" without checking. After your report, ask Arjun: "Want me to send the 🔴 Critical bugs to the Fixer Agent now?" If they say yes, use delegate_to_agent with agent_id "fixer" and include the full bug details as the task.`
  },
  reviewer: {
    name: 'Reviewer & Checker', icon: '🔍', color: '#ea580c',
    role: 'Code Quality & Security',
    tools: ['list_files', 'read_file', 'delegate_to_agent'],
    prompt: `You are the Reviewer & Checker Agent for Double-A Digital. You audit code for security vulnerabilities, code quality issues, and OWASP compliance. You NEVER edit files.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: Read files and check for: exposed API keys/secrets in code, XSS vulnerabilities, SQL injection risks, missing CSP headers, insecure dependencies, hardcoded credentials. Output a security report with severity ratings. Be specific — quote the exact vulnerable code.

Personality: Serious, security-focused. Quotes exact code lines. Uses 🔴🟡🟢 ratings. Ends with: "Security audit complete."`
  },
  fixer: {
    name: 'Fixer Agent', icon: '🔧', color: '#e11d48',
    role: 'Autonomous Bug Resolution',
    tools: ['list_files', 'read_file', 'write_file', 'edit_file'],
    prompt: `You are the Fixer Agent for Double-A Digital. You receive bug reports from the Tester and Reviewer and fix them. You are surgical — you fix exactly what's broken without changing anything else.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: When given a bug description, read the relevant file first with read_file, locate the exact issue, then use edit_file to fix ONLY that issue. Never rewrite whole files unless absolutely necessary. After fixing, describe exactly what you changed and why.

Personality: Efficient, precise. Says things like "Found it.", "Applying fix now.", "Fixed. Here's what changed:". No unnecessary words.`
  },
  innovator: {
    name: 'Innovator Thinker', icon: '💡', color: '#7c3aed',
    role: 'Research & Innovation',
    tools: ['list_files', 'read_file'],
    prompt: `You are the Innovator / Thinker Agent for Double-A Digital. You research the existing projects and generate actionable improvement ideas, new features, and monetization strategies.

PROJECTS: sowmithcuts=/Users/aarushgurram/Desktop/Double-A-Digital/SowmithCuts, biryani=/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations, agenthub=/Users/aarushgurram/AgentHub, vectiq=/Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases

YOUR JOB: Read the project files to understand what exists, then generate specific, actionable ideas ranked by impact and effort. Think about: missing features competitors have, monetization, UX improvements, performance wins, integrations. Be specific — not "add animations" but "add a CSS scroll-triggered fade-in on the menu items using Intersection Observer — 2 hour task".

Personality: Enthusiastic, visionary. Uses 💡 for ideas. Ranks ideas by 🔥 High / 🟡 Medium / 💤 Low impact.`
  },
};

function getAgentTools(agentId) {
  const cfg = AGENT_CONFIGS[agentId];
  if (!cfg) return TOOLS;
  return TOOLS.filter(t => cfg.tools.includes(t.function.name));
}

const TOOLS = [
  { type:'function', function:{ name:'git_status', description:'Check git status of a project to see changed/uncommitted files', parameters:{ type:'object', properties:{ repo_path:{ type:'string', description:'Path to git repo. Use project name like "sowmithcuts" or "agenthub" and we will resolve it.' }}, required:['repo_path'] }}},
  { type:'function', function:{ name:'git_push', description:'Stage all changes, commit, and push to GitHub', parameters:{ type:'object', properties:{ repo_path:{ type:'string', description:'Path to git repo or project name' }, message:{ type:'string', description:'Commit message' }}, required:['repo_path','message'] }}},
  { type:'function', function:{ name:'run_command', description:'Run a shell command in a project directory', parameters:{ type:'object', properties:{ repo_path:{ type:'string', description:'Working directory path or project name' }, command:{ type:'string', description:'Shell command to run' }}, required:['repo_path','command'] }}},
  { type:'function', function:{ name:'list_files', description:'List files in a directory', parameters:{ type:'object', properties:{ path:{ type:'string', description:'Directory path or project name' }}, required:['path'] }}},
  { type:'function', function:{ name:'read_file', description:'Read contents of a file (first 3000 chars)', parameters:{ type:'object', properties:{ file_path:{ type:'string', description:'Absolute path to file' }}, required:['file_path'] }}},
  { type:'function', function:{ name:'deploy', description:'Trigger a Netlify deploy hook for a site', parameters:{ type:'object', properties:{ site:{ type:'string', description:'Site name: sowmithcuts or biryani' }}, required:['site'] }}},
  { type:'function', function:{ name:'write_file', description:'Create a new file or fully overwrite an existing file with new content. Use for new files or complete rewrites.', parameters:{ type:'object', properties:{ file_path:{ type:'string', description:'Absolute path to the file to write' }, content:{ type:'string', description:'Full file content to write' }}, required:['file_path','content'] }}},
  { type:'function', function:{ name:'edit_file', description:'Find a specific string in a file and replace it with new content. Best for surgical edits — changing one element, updating text, fixing a bug.', parameters:{ type:'object', properties:{ file_path:{ type:'string', description:'Absolute path to the file' }, find:{ type:'string', description:'Exact string to find in the file' }, replace:{ type:'string', description:'String to replace it with' }}, required:['file_path','find','replace'] }}},
  { type:'function', function:{ name:'create_project', description:'Scaffold a new project folder with starter files (index.html, style.css, script.js)', parameters:{ type:'object', properties:{ name:{ type:'string', description:'Project folder name (e.g. MyApp)' }, location:{ type:'string', description:'Parent directory path. Defaults to Desktop/Double-A-Digital' }}, required:['name'] }}},
  { type:'function', function:{ name:'read_file_lines', description:'Read a specific range of lines from a file. Use this for large files to read in chunks.', parameters:{ type:'object', properties:{ file_path:{ type:'string', description:'Absolute path to the file' }, start:{ type:'number', description:'Start line number (1-indexed)' }, end:{ type:'number', description:'End line number (1-indexed)' }}, required:['file_path','start','end'] }}},
  { type:'function', function:{ name:'delegate_to_agent', description:'Delegate a task to another specialist agent and get their response and actions.', parameters:{ type:'object', properties:{ agent_id:{ type:'string', enum:['architect','frontend-lead','frontend-support','backend','email','devops','tester','reviewer','fixer','innovator'], description:'Which agent to delegate to' }, task:{ type:'string', description:'Clear description of the task for that agent' }}, required:['agent_id','task'] }}},
];

const SYSTEM_PROMPT = `You are the Agent Hub Assistant for Double-A Digital. You have REAL tools to take actions on the owner's projects. Always use tools when the user asks you to do something actionable.

OWNER: Arjun — developer building websites and apps

PROJECTS (use these exact names when calling tools):
- sowmithcuts → /Users/aarushgurram/SowmithCuts (barber booking, live at sowmithcuts.netlify.app)
- biryani → /Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations (Indian catering site)
- agenthub → /Users/aarushgurram/AgentHub (this dashboard)
- vectiq → /Users/aarushgurram/Desktop/Double-A-Digital/PhysicsCases (AP Physics app)

TOOLS AVAILABLE:
- git_status: check what's changed in a repo
- git_push: stage, commit, push to GitHub
- run_command: run any shell command
- list_files: see files in a directory
- read_file: read a file's contents (first 3000 chars)
- write_file: create or fully overwrite a file with new content
- edit_file: find a specific string in a file and replace it (surgical edits)
- create_project: scaffold a new project folder with index.html, style.css, script.js
- deploy: trigger a Netlify deploy hook

WHEN TO USE TOOLS:
- Always use tools for ANY actionable request — never just describe what you'd do
- To change a website: read_file first → then write_file or edit_file
- For small targeted changes (fix one element, update text): use edit_file
- For new files or full rewrites: use write_file
- For new projects: use create_project, then write_file for each file
- After editing: always offer to git_push

IMPORTANT: When writing HTML/CSS/JS, write complete, production-quality code. Be thorough.

10 AGENTS ON THE TEAM:
🧠 Architect, 🎨 Frontend Lead, 🖌️ Frontend Support, ⚙️ Backend, 📧 Email & Comms, 🚀 GitHub DevOps, 🧪 Tester, 🔍 Reviewer, 🔧 Fixer, 💡 Innovator

Be concise and friendly. Use emojis. After tool calls, clearly summarize what changed.`;

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

function resolveProjectPath(input) {
  const key = Object.keys(PROJECTS).find(k => input.toLowerCase().includes(k.toLowerCase()));
  return key ? PROJECTS[key] : input;
}

async function executeTool(name, args) {
  try {
    switch (name) {
      case 'git_status': {
        const p = resolveProjectPath(args.repo_path || '');
        const { stdout } = await execAsync('git status', { cwd: p, shell: true });
        return stdout.trim() || 'Nothing to report.';
      }
      case 'git_push': {
        const p = resolveProjectPath(args.repo_path || '');
        const msg = (args.message || 'Update from Agent Hub').replace(/"/g, '\\"');
        const { stdout } = await execAsync(`git add -A && git commit -m "${msg}" && git push`, { cwd: p, shell: true });
        return stdout.trim() || 'Pushed successfully.';
      }
      case 'run_command': {
        const p = resolveProjectPath(args.repo_path || '');
        const { stdout, stderr } = await execAsync(args.command, { cwd: p, timeout: 30000, shell: true });
        return (stdout + stderr).trim() || 'Command completed with no output.';
      }
      case 'list_files': {
        const p = resolveProjectPath(args.path || '');
        const { stdout } = await execAsync(`ls -la "${p}"`, { shell: true });
        return stdout.trim();
      }
      case 'read_file': {
        const content = fs.readFileSync(args.file_path, 'utf8');
        const lines = content.split('\n');
        if (lines.length > 150) {
          return `File has ${lines.length} lines. Showing lines 1-150:\n\n` +
            lines.slice(0, 150).map((l, i) => `${i+1}: ${l}`).join('\n') +
            `\n\n[File continues — use read_file_lines to read specific ranges]`;
        }
        return lines.map((l, i) => `${i+1}: ${l}`).join('\n');
      }
      case 'read_file_lines': {
        const lines = fs.readFileSync(args.file_path, 'utf8').split('\n');
        const start = Math.max(0, (args.start || 1) - 1);
        const end = Math.min(lines.length, args.end || lines.length);
        return `Lines ${start+1}-${end} of ${lines.length}:\n\n` +
          lines.slice(start, end).map((l, i) => `${start+i+1}: ${l}`).join('\n');
      }
      case 'deploy': {
        const hook = DEPLOY_HOOKS[args.site?.toLowerCase()];
        if (!hook) return `No deploy hook for "${args.site}". Add NETLIFY_HOOK_${(args.site||'').toUpperCase()} to .env`;
        const hookUrl = new URL(hook);
        await httpsPost(hookUrl.hostname, hookUrl.pathname + hookUrl.search, {}, {});
        return `Deploy triggered for ${args.site}!`;
      }
      case 'write_file': {
        const dir = path.dirname(args.file_path);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(args.file_path, args.content, 'utf8');
        const lines = args.content.split('\n').length;
        return `Written ${lines} lines to ${args.file_path}`;
      }
      case 'edit_file': {
        let content = fs.readFileSync(args.file_path, 'utf8');
        if (!content.includes(args.find)) return `Error: string not found in ${args.file_path}. Read the file first to get the exact text.`;
        const updated = content.replace(args.find, args.replace);
        fs.writeFileSync(args.file_path, updated, 'utf8');
        return `Edited ${args.file_path} — replaced target string successfully.`;
      }
      case 'create_project': {
        const base = args.location || '/Users/aarushgurram/Desktop/Double-A-Digital';
        const projectPath = path.join(base, args.name);
        fs.mkdirSync(projectPath, { recursive: true });
        fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${args.name}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<h1>${args.name}</h1>\n<script src="script.js"></script>\n</body>\n</html>`);
        fs.writeFileSync(path.join(projectPath, 'style.css'), `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; }`);
        fs.writeFileSync(path.join(projectPath, 'script.js'), `console.log('${args.name} loaded');`);
        PROJECTS[args.name.toLowerCase()] = projectPath;
        return `Created project "${args.name}" at ${projectPath} with index.html, style.css, script.js`;
      }
      case 'delegate_to_agent': {
        const targetId = args.agent_id;
        const cfg = AGENT_CONFIGS[targetId];
        if (!cfg) return `Unknown agent: ${targetId}`;
        try {
          const { reply, steps } = await groqAgentChat(targetId, [{ role:'user', content: args.task }]);
          const stepSummary = steps.length
            ? '\n\nActions taken:\n' + steps.map(s => `  ${s.ok?'✅':'⚠️'} ${s.tool}: ${s.result.slice(0,100)}`).join('\n')
            : '';
          return `${cfg.icon} ${cfg.name} completed:\n\n${reply}${stepSummary}`;
        } catch(e) {
          return `Error delegating to ${targetId}: ${e.message}`;
        }
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function groqChatWithTools(messages, steps = []) {
  const result = await httpsPost('api.groq.com', '/openai/v1/chat/completions', {
    Authorization: `Bearer ${GROQ_KEY}`
  }, { model: 'llama-3.1-8b-instant', messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 1500, temperature: 0.7 });

  const choice = result?.choices?.[0];
  if (!choice) {
    const errMsg = result?.error?.message || '';
    console.error('[Groq error]', errMsg);
    // Rate limit hit — if tools already ran successfully, summarize locally
    if (steps.length > 0 && errMsg.toLowerCase().includes('rate limit')) {
      const ok = steps.filter(s => s.ok);
      const fail = steps.filter(s => !s.ok);
      const parts = ok.map(s => `✅ ${s.tool.replace(/_/g,' ')}: ${s.result.slice(0,80)}`);
      if (fail.length) parts.push(...fail.map(s => `⚠️ ${s.tool.replace(/_/g,' ')}: ${s.result.slice(0,60)}`));
      return { reply: `Done! Here's what the agents completed:\n\n${parts.join('\n')}`, steps };
    }
    return { reply: `Sorry, the AI hit a rate limit. The tools ran — check the steps above.`, steps };
  }

  if (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
    const toolMsgs = [];
    for (const tc of choice.message.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      const res = await executeTool(tc.function.name, args);
      steps.push({ tool: tc.function.name, args, result: res, ok: !res.startsWith('Error:') });
      // Truncate tool results fed back to Groq to stay within TPM limits
      toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: res.slice(0, 400) });
    }
    return groqChatWithTools([...messages, choice.message, ...toolMsgs], steps);
  }

  return { reply: choice.message?.content || 'Done!', steps };
}

async function groqAgentChat(agentId, messages, steps = []) {
  const cfg = AGENT_CONFIGS[agentId];
  if (!cfg) return groqChatWithTools(messages, steps);

  // Inject persistent memory on first call
  if (steps.length === 0) {
    const memory = loadAgentMemory(agentId);
    if (memory.length > 0) messages = [...memory.slice(-8), ...messages];
  }

  const agentTools = getAgentTools(agentId);
  const result = await httpsPost('api.groq.com', '/openai/v1/chat/completions', {
    Authorization: `Bearer ${GROQ_KEY}`
  }, {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'system', content: cfg.prompt }, ...messages],
    tools: agentTools.length > 0 ? agentTools : undefined,
    tool_choice: agentTools.length > 0 ? 'auto' : undefined,
    max_tokens: 1500,
    temperature: 0.7
  });

  const choice = result?.choices?.[0];
  if (!choice) {
    const errMsg = result?.error?.message || '';
    if (steps.length > 0 && errMsg.toLowerCase().includes('rate limit')) {
      const parts = steps.map(s => `${s.ok ? '✅' : '⚠️'} ${s.tool.replace(/_/g,' ')}: ${s.result.slice(0,80)}`);
      return { reply: `Done! Here's what I completed:\n\n${parts.join('\n')}`, steps };
    }
    return { reply: `Sorry, hit a rate limit. Try again in a moment.`, steps };
  }

  if (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
    const toolMsgs = [];
    for (const tc of choice.message.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      const res = await executeTool(tc.function.name, args);
      steps.push({ tool: tc.function.name, args, result: res, ok: !res.startsWith('Error:') });
      toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: res.slice(0, 400) });
    }
    return groqAgentChat(agentId, [...messages, choice.message, ...toolMsgs], steps);
  }

  return { reply: choice.message?.content || 'Done!', steps };
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
        ...history.slice(-4),
        { role: 'user', content: message }
      ];
      const { reply, steps } = await groqChatWithTools(messages);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply, steps }));
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

  // ── POST /api/agent/:id ─────────────────────────────────────
  if (req.method === 'POST' && url.pathname.startsWith('/api/agent/')) {
    const agentId = url.pathname.replace('/api/agent/', '').split('/')[0];
    if (!AGENT_CONFIGS[agentId]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: `Unknown agent: ${agentId}`, steps: [] }));
      return;
    }
    try {
      const { message, history = [] } = await parseBody(req);
      const messages = [...history.slice(-4), { role: 'user', content: message }];
      const { reply, steps } = await groqAgentChat(agentId, messages);
      saveAgentMemory(agentId, [...messages, { role: 'assistant', content: reply }]);
      // Log real activity to Supabase
      const cfg2 = AGENT_CONFIGS[agentId];
      const activityMsg = steps.length
        ? steps.filter(s=>s.ok).map(s=>`${s.tool.replace(/_/g,' ')}: ${s.result.slice(0,80)}`).join(' · ') || reply.slice(0,100)
        : reply.slice(0, 100);
      try {
        await httpsPost(sbHost, '/rest/v1/agent_activity', sbHeaders,
          { agent_id: agentId, agent_name: cfg2.name, message: activityMsg, level: steps.some(s=>!s.ok)?'warn':'ok' });
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply, steps, agent: agentId }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Server error.', steps: [] }));
    }
    return;
  }

  // ── DELETE /api/agent/:id/memory ────────────────────────────
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/agent/') && url.pathname.endsWith('/memory')) {
    const agentId = url.pathname.split('/')[3];
    try { fs.unlinkSync(path.join(MEMORY_DIR, `${agentId}.json`)); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── GET /api/agents ─────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/agents') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.entries(AGENT_CONFIGS).map(([id, cfg]) => ({
      id, name: cfg.name, icon: cfg.icon, color: cfg.color, role: cfg.role
    }))));
    return;
  }

  // ── GET /api/integrations ────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/integrations') {
    const results = [];

    // Groq — key present and used
    results.push({ id:'groq', name:'Groq AI', icon:'🤖', desc:'Powers all agent conversations', connected: !!GROQ_KEY });

    // Supabase — key + url present
    results.push({ id:'supabase', name:'Supabase', icon:'⚡', desc:'Realtime activity feed & tasks', connected: !!(SB_KEY && SB_URL) });

    // GitHub — at least one project has a git remote
    let hasGitRemote = false;
    for (const p of Object.values(PROJECTS)) {
      try { const { stdout } = await execAsync('git remote -v', { cwd: p, shell: true }); if (stdout.trim()) { hasGitRemote = true; break; } } catch {}
    }
    results.push({ id:'github', name:'GitHub', icon:'🐙', desc:'Version control & pushes', connected: hasGitRemote });

    // Vercel — check if vercel CLI is installed and token is present
    let vercelConnected = false;
    try { await execAsync('node_modules/.bin/vercel --version', { cwd: __dirname, shell: true }); vercelConnected = true; } catch {}
    results.push({ id:'vercel', name:'Vercel', icon:'▲', desc:'Dashboard hosting & deploy', connected: vercelConnected });

    // SendGrid — api key env var
    results.push({ id:'sendgrid', name:'SendGrid', icon:'📨', desc:'Email & notifications', connected: !!process.env.SENDGRID_KEY });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }

  // ── GET /api/vault ───────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/vault') {
    const entries = [];
    for (const [id, cfg] of Object.entries(AGENT_CONFIGS)) {
      const f = path.join(MEMORY_DIR, `${id}.json`);
      if (!fs.existsSync(f)) continue;
      try {
        const msgs = JSON.parse(fs.readFileSync(f, 'utf8'));
        const stat = fs.statSync(f);
        const last = msgs.filter(m => m.role === 'assistant').pop();
        if (last) entries.push({
          agent: `${cfg.icon} ${cfg.name}`,
          preview: last.content.slice(0, 120),
          messageCount: msgs.length,
          lastUpdated: stat.mtime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
      } catch {}
    }
    entries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entries));
    return;
  }

  // ── GET /api/stats ───────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    const now = Date.now();
    let activeAgents = 0, tasksDone = 0;
    const agents = {};
    for (const [id] of Object.entries(AGENT_CONFIGS)) {
      const f = path.join(MEMORY_DIR, `${id}.json`);
      if (fs.existsSync(f)) {
        tasksDone++;
        const age = now - fs.statSync(f).mtime.getTime();
        const status = age < 30 * 60 * 1000 ? 'active' : 'idle';
        if (status === 'active') activeAgents++;
        // Find last user message as "last task"
        let lastTask = 'No tasks run yet';
        try {
          const msgs = JSON.parse(fs.readFileSync(f, 'utf8'));
          const lastUser = [...msgs].reverse().find(m => m.role === 'user');
          if (lastUser) lastTask = String(lastUser.content).slice(0, 80);
        } catch {}
        agents[id] = { status, lastTask };
      } else {
        agents[id] = { status: 'idle', lastTask: 'Waiting for a task…' };
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ activeAgents, tasksDone, agents }));
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
