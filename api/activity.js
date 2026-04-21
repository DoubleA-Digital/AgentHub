const SB_URL = process.env.SB_URL || '';
const SB_KEY = process.env.SB_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

  if (req.method === 'GET') {
    const r = await fetch(`${SB_URL}/rest/v1/agent_activity?order=created_at.desc&limit=50`, { headers });
    const data = await r.json();
    res.status(200).json(Array.isArray(data) ? data : []);
  } else if (req.method === 'POST') {
    const r = await fetch(`${SB_URL}/rest/v1/agent_activity`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(req.body)
    });
    res.status(r.ok ? 201 : 500).json({ ok: r.ok });
  } else {
    res.status(405).end();
  }
}
