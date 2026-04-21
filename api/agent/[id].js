export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { messages } = req.body || {};
  const GROQ_KEY = process.env.GROQ_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_KEY not set' });

  const AGENT_PROMPTS = {
    architect: 'You are Architect, an expert software architect. Plan systems, design APIs, and delegate work.',
    'frontend-lead': 'You are Frontend Lead, an expert in modern UI/UX, Three.js, GSAP, and React.',
    'frontend-support': 'You are Frontend Support, focused on CSS, animations, and asset optimization.',
    backend: 'You are Backend Agent, expert in Node.js, databases, and REST APIs.',
    email: 'You are Email & Comms agent, expert in email templates and notification systems.',
    devops: 'You are GitHub DevOps, expert in git, CI/CD, Vercel, and Netlify deployments.',
    tester: 'You are Tester Agent, expert in automated testing and quality assurance.',
    reviewer: 'You are Reviewer, expert in code quality, security, and best practices.',
    fixer: 'You are Fixer Agent, expert in debugging and fixing bugs surgically.',
    innovator: 'You are Innovator Thinker, focused on research, ideas, and growth strategies.',
  };

  const systemPrompt = AGENT_PROMPTS[id] || 'You are an AI assistant.';
  const fullMessages = [{ role: 'system', content: systemPrompt + ' Note: running in cloud mode — no local file access.' }, ...messages];

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: fullMessages, max_tokens: 1500 })
  });
  const data = await r.json();
  const reply = data.choices?.[0]?.message?.content || 'No response';
  res.status(200).json({ reply, steps: [] });
}
