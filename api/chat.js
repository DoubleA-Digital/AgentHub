export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const GROQ_KEY = process.env.GROQ_KEY;
  if (!GROQ_KEY) return res.status(500).json({ reply: 'GROQ_KEY not configured.' });

  let messages = req.body?.messages;
  if (!messages) {
    const history = req.body?.history || [];
    const text = req.body?.message || '';
    messages = [...history, { role: 'user', content: text }];
  }

  const system = { role: 'system', content: `You are the Agent Hub assistant for Double-A Digital, owned by Aarush Gurram.

YOU CANNOT BUILD ANYTHING. You are a text-only assistant with no tools, no file access, and no ability to run code or create websites. Do not pretend otherwise.

REAL PROJECTS (the only ones that exist):
- SowmithCuts — barber booking site, live at sowmithcuts.netlify.app
- BiryaniTemptations — Indian catering site
- VectIQ — AP Physics daily-case app
- AgentHub — this dashboard, live at agent-hub-sigma-nine.vercel.app

RULES — follow these exactly:
1. If asked to build, create, or deploy anything: say clearly "I can't build things here — go to localhost:3000/chat.html, pick a specific agent like Frontend Lead or Architect, and ask them directly. They have real tools."
2. If asked what agents are doing: say they are idle waiting for tasks. Never say they are "working on" anything.
3. Never invent fake progress updates, fake timelines, fake task distributions, or fake notifications.
4. Never say "I've instructed [agent] to..." — you cannot instruct agents. Only Aarush can by chatting with them directly.
5. Be short and direct. No fluff.` };

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [system, ...messages], max_tokens: 600 })
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ reply: `Error: ${JSON.stringify(data.error || data)}` });
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ reply: `Request failed: ${e.message}` });
  }
}
