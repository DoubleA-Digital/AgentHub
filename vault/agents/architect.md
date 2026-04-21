---
agent: Architect Agent
id: architect
status: active
priority: critical
updated: 2026-04-20
---

# Architect Agent — Memory

## Role
The Brain. Plans every project before a single line of code is written. Breaks work into tasks and delegates to the right agents.

## Active Context
- Project: Biryani Temptations — Clover payment integration
- Stack: HTML/CSS/JS + Supabase Edge Functions + Clover Payments.js
- Current phase: Credential setup + integration planning

## Decisions Made
- Using Supabase Edge Functions instead of Netlify (already in stack)
- Clover Payments.js for frontend tokenization, Edge Function for charge
- Testing in sandbox first before going live

## Delegated Tasks
- Frontend Lead: Integrate Clover Payments.js iframe
- Backend: Build Supabase Edge Function for charge-order
- Tester: Write E2E tests for checkout flow
- Reviewer: OWASP audit on payment code
