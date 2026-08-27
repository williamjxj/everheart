# Everheart — Technical Design (MVP / POC)

## 1. Goals for this MVP

- Solo-developer feasible
- Working creation pipeline + chat with memory
- One-time payment path (Stripe test)
- Exportable character cards (SillyTavern compatible)
- Clear path to production (BYOK, entitlements, safety gates)

## 2. High-level architecture

```
Browser (Next.js PWA)
        │
        ▼
Next.js App Router
  ├── /api/create          → creation pipeline (DeepSeek)
  ├── /api/chat            → orchestration + streaming
  ├── /api/entitlements/*  → Stripe checkout + webhook
  └── pages (create, chat, pricing, success; homepage companion gallery)
        │
        ▼
Supabase Postgres via Prisma (eh_* tables; pgvector later)
  users · companions · messages · memory_facts · summaries · ledger · entitlements
        │
External
  DeepSeek (LLM) · Stripe · (later) age verification · image workers
```

## 3. Creation pipeline (chained stages)

1. **Persona brief** → JSON (name, age≥18, personality, speech, backstory, dynamic, kinks/limits)
2. **Scenario seeds** → openings + long arcs + first_mes
3. **Dialogue style** → sample lines + mes_example
4. **Compile** → full CharacterCard (Zod validated)

Each stage uses structured JSON output + schema validation + model fallback ladder.

Cost target: $0.05–0.30 per creation.

## 4. Chat orchestration

```
User message
  → Safety gate (input)
  → Router (BYOK / credits / model tier)
  → Context assembler (card + summary + facts + recent N)
  → Stream generation
  → Safety gate (output)
  → Async: extract facts + optional summary update
  → Persist messages + new facts
```

Memory is hybrid: rolling summary + facts (pgvector after Postgres) + structured relationship facts.

## 5. Monetization (MVP)

| Stream        | Price     | Notes                          |
|---------------|-----------|--------------------------------|
| Starter       | $29       | 50k tokens, core features      |
| Standard      | $49       | 200k tokens + NSFW unlock      |
| Creator       | $79       | 500k + future marketplace      |
| Token packs   | $5 / $18 / $75 | Overage                     |
| BYOK          | $0 extra  | Pure margin after license      |

Webhook activates `Entitlement` + credits into `LedgerEntry`.

## 6. Safety & compliance (non-negotiable baseline)

- Age ≥ 18 hard-coded in persona schema
- Input/output keyword + pattern gate for minors
- Adult content only when `isAdultVerified = true`
- No real-person likeness prompts (expand later)
- AI disclosure on all generated companions
- Encrypted BYOK key storage (never plain text)

## 7. File map (what was generated)

```
everheart/
├── README.md                    # includes homepage screenshot
├── screenshots/home.png         # recapture: pnpm screenshot:home
├── TECHNICAL_DESIGN.md
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/schema.prisma
├── scripts/
│   ├── test-creation-pipeline.ts
│   ├── screenshot.mjs
│   └── screenshot.config.mjs
└── src/
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css
    │   └── api/
    │       ├── create/route.ts
    │       ├── chat/route.ts
    │       └── entitlements/{checkout,webhook}/route.ts
    ├── lib/
    │   ├── llm/{deepseek,creation-pipeline,chat-orchestrator}.ts
    │   ├── memory/{context-assembler,fact-extractor}.ts
    │   ├── payments/stripe.ts
    │   ├── cards/export.ts
    │   └── db/client.ts
    └── types/character-card.ts
```

## 8. How to run the POC

1. `cd everheart && pnpm install`
2. Copy `.env.example` → `.env.local` and fill keys
3. Supabase Postgres is configured via `DATABASE_URL` (pooler 6543, runtime)
   and `DIRECT_URL` (5432, migrations) — tables are created with the `eh_` prefix
4. `pnpm prisma generate && pnpm prisma db push`
5. `pnpm dev`
6. Test pipeline: `DEEPSEEK_API_KEY=... pnpm pipeline:test`

## 9. Immediate next implementation steps

1. Auth (Clerk or NextAuth) + protect API routes
2. Persist companions & messages to DB
3. Credit balance check before LLM calls
4. Simple Create UI (form → call /api/create → show card)
5. Simple Chat UI (select companion → stream /api/chat)
6. Stripe test mode + success page
7. Basic portrait generation (fal / Replicate)
8. Age verification integration when ready for NSFW

## 10. Later (phase 2+)

- Full vector retrieval with embeddings
- Voice packs (XTTS / Kokoro)
- ComfyUI workers for portraits
- Creator marketplace + Stripe Connect
- Tauri desktop shell
- PWA offline / install prompts
