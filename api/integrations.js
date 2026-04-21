export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json([
    { id:'groq',     name:'Groq AI',   icon:'🤖', connected: !!process.env.GROQ_KEY,  desc:'Powers all agent conversations' },
    { id:'supabase', name:'Supabase',  icon:'⚡', connected: !!(process.env.SB_KEY && process.env.SB_URL), desc:'Realtime activity feed' },
    { id:'vercel',   name:'Vercel',    icon:'▲',  connected: true,                      desc:'Hosting this dashboard', detail: process.env.VERCEL_URL || '' },
    { id:'sendgrid', name:'SendGrid',  icon:'📨', connected: !!process.env.SENDGRID_KEY, desc:'Email & notifications' },
  ]);
}
