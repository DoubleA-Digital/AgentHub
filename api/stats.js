const SB_URL = process.env.SB_URL || '';
const SB_KEY = process.env.SB_KEY || '';

const AGENT_IDS = ['architect','frontend-lead','frontend-support','backend','email','devops','tester','reviewer','fixer','innovator'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Count activity messages today
  let tasksDone = 0;
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const r = await fetch(
      `${SB_URL}/rest/v1/agent_activity?created_at=gte.${today.toISOString()}&select=id`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const rows = await r.json();
    tasksDone = Array.isArray(rows) ? rows.length : 0;
  } catch {}

  // On Vercel agents are always idle (no local memory files)
  const agents = {};
  AGENT_IDS.forEach(id => { agents[id] = { status: 'idle', lastTask: 'Local server not connected' }; });

  res.status(200).json({ activeAgents: 0, tasksDone, agents });
}
