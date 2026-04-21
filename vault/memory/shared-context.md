---
type: shared-context
updated: 2026-04-20
---

# Shared Agent Context

## Active Projects
- **Biryani Temptations** — Indian catering website
  - Path: `/Users/aarushgurram/Desktop/Double-A-Digital/BiryaniTemptations/`
  - Stack: HTML/CSS/JS, Supabase, EmailJS → migrating to SendGrid
  - Live: pending deployment
  - Current focus: Clover payment integration

- **SowmithCuts** — Barber booking site
  - Live: sowmithcuts.netlify.app
  - Stack: Firebase + Netlify

## Tech Decisions Log
| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-20 | Use Supabase Edge Functions for Clover | Already in stack, free tier |
| 2026-04-20 | Sandbox-first Clover testing | Avoid real charges during dev |
| 2026-04-20 | Ruflo MCP for agent coordination | Claude Code native integration |

## Environment
- Node.js: installed
- Supabase CLI: needs install
- Clover sandbox: account created
