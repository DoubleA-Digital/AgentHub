export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const GROQ_KEY = process.env.GROQ_KEY;
  if (!GROQ_KEY) return res.status(500).json({ reply: 'GROQ_KEY not configured on server.' });

  // Accept both { messages } and { message, history } formats
  let messages = req.body?.messages;
  if (!messages) {
    const history = req.body?.history || [];
    const text = req.body?.message || '';
    messages = [...history, { role: 'user', content: text }];
  }

  const system = { role: 'system', content: `You are the Agent Hub assistant for Double-A Digital, a small web dev agency run by Aarush Gurram.

REAL PROJECTS (the only projects that exist):
- SowmithCuts — barber booking website, live at sowmithcuts.netlify.app
- BiryaniTemptations — Indian catering site with Supabase + EmailJS
- VectIQ (PhysicsCases) — AP Physics daily-case app, localStorage only
- AgentHub — this AI agent dashboard, live at agent-hub-sigma-nine.vercel.app

REAL AGENTS (10 total — they only work when Aarush talks to them directly):
Architect, Frontend Lead, Frontend Support, Backend Agent, Email & Comms, GitHub DevOps, Tester Agent, Reviewer, Fixer Agent, Innovator Thinker.

CRITICAL RULES:
- NEVER invent fake project names like "EcoHub", "GreenLife", or any project not listed above.
- Agents are IDLE unless Aarush has explicitly assigned them a task in this conversation.
- If asked what agents are doing, say they are idle and waiting for tasks — do not make up activity.
- Only describe work that has actually been requested in this chat session.
- Be honest, direct, and concise.` };

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [system, ...messages], max_tokens: 1500 })
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ reply: `Groq error: ${JSON.stringify(data.error || data)}` });
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ reply: `Request failed: ${e.message}` });
  }
}
