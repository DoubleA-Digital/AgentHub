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

  const system = { role: 'system', content: 'You are the Agent Hub team assistant for Double-A Digital. You coordinate 10 specialized AI agents (Architect, Frontend Lead, Frontend Support, Backend, Email & Comms, GitHub DevOps, Tester, Reviewer, Fixer, Innovator). Answer questions about the team and projects.' };

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
