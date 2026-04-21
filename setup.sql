-- Run this entire block in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  agent_id TEXT DEFAULT 'architect',
  agent_name TEXT DEFAULT 'Architect',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read/write (dashboard uses anon key)
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read activity" ON agent_activity FOR SELECT USING (true);
CREATE POLICY "Public insert activity" ON agent_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read tasks" ON agent_tasks FOR SELECT USING (true);
CREATE POLICY "Public insert tasks" ON agent_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tasks" ON agent_tasks FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agent_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;

-- Seed initial tasks
INSERT INTO agent_tasks (title, agent_id, agent_name, status) VALUES
  ('Initialize Agent Hub dashboard', 'architect', 'Architect', 'done'),
  ('Configure 10-agent swarm topology', 'architect', 'Architect', 'done'),
  ('Connect Groq AI to chatbot', 'backend', 'Backend Agent', 'done'),
  ('Build Supabase Edge Function: charge-order', 'backend', 'Backend Agent', 'progress'),
  ('Integrate Clover Payments.js into checkout', 'frontend-lead', 'Frontend Lead', 'progress'),
  ('Write E2E tests for checkout flow', 'tester', 'Tester Agent', 'pending'),
  ('OWASP security audit on payment code', 'reviewer', 'Reviewer', 'pending'),
  ('Design order confirmation email template', 'email', 'Email & Comms', 'pending'),
  ('Research AR menu previews (WebXR)', 'innovator', 'Innovator', 'pending');

-- Seed initial activity
INSERT INTO agent_activity (agent_id, agent_name, message, level) VALUES
  ('architect', 'Architect', 'Agent Hub initialized. All 10 agents online and connected.', 'ok'),
  ('backend', 'Backend Agent', 'Groq AI connected to chatbot — real responses enabled.', 'ok'),
  ('backend', 'Backend Agent', 'Supabase realtime feed is now live — this is a real entry!', 'ok'),
  ('innovator', 'Innovator Thinker', 'Research started: AR menu previews for Biryani Temptations using WebXR.', 'idea'),
  ('tester', 'Tester Agent', 'E2E test suite initialized — 47 tests queued for checkout flow.', 'info'),
  ('architect', 'Architect', 'Delegating Clover payment integration to Backend + Frontend Lead.', 'info');
