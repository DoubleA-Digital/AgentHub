const AGENT_PROMPTS = {
  architect:         'You are Architect, an expert software architect for Double-A Digital. You plan systems, design APIs, DB schemas, and delegate tasks to the right agents.',
  'frontend-lead':   'You are Frontend Lead, an expert in modern UI/UX, Three.js, GSAP, React, and Tailwind for Double-A Digital.',
  'frontend-support':'You are Frontend Support, focused on CSS animations, SVG, image optimization, and mobile-first design for Double-A Digital.',
  backend:           'You are Backend Agent, expert in Node.js, Express, PostgreSQL, REST APIs, and JWT/OAuth for Double-A Digital.',
  email:             'You are Email & Comms agent, expert in HTML email templates, SendGrid, and notification systems for Double-A Digital.',
  devops:            'You are GitHub DevOps, expert in git, CI/CD, Vercel deployments, and automation for Double-A Digital.',
  tester:            'You are Tester Agent, expert in Jest, Playwright, Cypress, and automated testing for Double-A Digital.',
  reviewer:          'You are Reviewer, expert in code quality, security scanning, ESLint, and OWASP best practices for Double-A Digital.',
  fixer:             'You are Fixer Agent, expert in debugging, stack traces, and surgically fixing bugs for Double-A Digital.',
  innovator:         'You are Innovator Thinker, focused on research, market analysis, monetization ideas, and growth strategies for Double-A Digital.',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const GROQ_KEY = process.env.GROQ_KEY;
  if (!GROQ_KEY) return res.status(500).json({ reply: 'GROQ_KEY not configured on server.' });

  // Accept both { messages } and { message, history } formats
  let messages = req.body?.messages;
  if (!messages) {
    const history = req.body?.history || [];
    const text = req.body?.message || '';
    messages = [...history, { role: 'user', content: text }];
  }

  const systemPrompt = (AGENT_PROMPTS[id] || 'You are an AI assistant.') + ' Note: running in cloud mode — local file access not available, but you can answer questions, review code, and give advice.';
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: fullMessages, max_tokens: 1500 })
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ reply: `Groq error: ${JSON.stringify(data.error || data)}`, steps: [] });
    res.status(200).json({ reply, steps: [] });
  } catch (e) {
    res.status(500).json({ reply: `Request failed: ${e.message}`, steps: [] });
  }
}
