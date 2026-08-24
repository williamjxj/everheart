# Everheart — AI Companions You Own Forever

**Working title · Generative AI companion app · One-time payment · 18+ optional**

Create or buy AI companions (chat, portrait, voice, long-term memory) for a one-time price. Adult content supported behind verified 18+ checks.

> **2026-08-23: merged with `codex-everheart`.** This repo is now the single
> Everheart app. The Codex demo's offline chat engine (`src/lib/offline/brain.js`),
> offline persona generator (`src/lib/offline/persona.js`), AgeGate component,
> and product design doc (`docs/ai-companion-app-design.md`) were ported here.
> The app now works **fully offline** (no API key needed) and upgrades
> automatically to DeepSeek streaming when `DEEPSEEK_API_KEY` is set.

## Quick Start (MVP / POC)

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- A Supabase project (Postgres). Tables use the `eh_` prefix and are created
  via `pnpm prisma db push` — runtime uses the pooler URL, migrations use DIRECT_URL.
- DeepSeek API key (for LLM)
- Stripe account (test mode for payments)

### Setup

```bash
cd everheart
pnpm install
cp .env.example .env.local
# Fill in DATABASE_URL/DIRECT_URL (Supabase), DEEPSEEK_API_KEY, STRIPE_SECRET_KEY, etc.
pnpm prisma generate
pnpm prisma db push
pnpm dev
```

Open http://localhost:3000 (under the platform supervisor: http://localhost:4904)

### Database

All tables live in Supabase Postgres with the `eh_` prefix (`eh_user`,
`eh_companion`, `eh_message`, `eh_memory_fact`, `eh_summary`, `eh_entitlement`,
`eh_ledger_entry`, `eh_character_card_template`). `DATABASE_URL` points at the
transaction-mode pooler (6543) for runtime; `DIRECT_URL` (5432) is used by
`prisma db push` for migrations.

### Environment Variables

See `.env.example`.

### Core Features in this MVP

1. **Companion Creation Pipeline** – multi-stage LLM chain producing a SillyTavern-compatible character card
   (falls back to the deterministic offline generator without a key)
2. **Chat with Memory** – streaming replies + rolling summaries + facts (vector search after Postgres);
   offline rule-based replies when DeepSeek is unavailable
3. **Entitlements** – one-time license unlocks credits / features
4. **BYOK** – bring your own DeepSeek key
5. **Card Import/Export** – V2/V3 JSON + PNG metadata support (basic)
6. **18+ AgeGate** – NSFW companions are gated behind an age confirmation
   (demo; replace with real identity verification before production)

### Roadmap Status

- [x] Project skeleton & schema
- [x] Creation pipeline (LLM stages + Zod)
- [x] Offline creation + chat fallback (merged from codex-everheart)
- [x] Chat orchestration + memory helpers
- [x] Stripe entitlement stubs
- [x] 18+ AgeGate (demo confirmation)
- [ ] Full UI polish
- [ ] Production age verification
- [ ] Portrait / voice workers
- [ ] Marketplace (phase 2)

## Architecture Overview

```
Next.js (App Router) + TypeScript
├── API routes (create, chat, cards, entitlements)
├── Supabase Postgres via Prisma (eh_* tables; pooler for runtime, direct for migrations)
├── DeepSeek (BYOK + bundled)
├── Redis / background jobs (optional for POC)
└── Stripe Checkout (one-time)
```

## License

Private / proprietary for now. Character cards exported follow open SillyTavern specs.
