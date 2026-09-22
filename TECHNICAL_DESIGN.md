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
  ├── /api/tts             → speech (edge-tts → local Kokoro fallback)
  ├── /api/companions      → roster (Supabase eh_companion)
  ├── /api/companions/:id/portrait → on-demand ComfyUI portrait
  ├── /api/companions/:id/messages → server-side chat history
  ├── /api/memory          → per-player memory: GET / PUT / DELETE, plus
  │                          /api/memory/extract (facts + rolling summary),
  │                          /api/memory/fact (forget one), /api/memory/export
  ├── /api/entitlements/*  → Stripe checkout + webhook
  └── pages (create, chat/[companionId], pricing, success; homepage gallery)
        │
        ▼
Supabase Postgres via Prisma (eh_* tables; pgvector later)
  users · companions · messages · memory_facts · summaries · ledger · entitlements
        │
External
  DeepSeek (LLM) · Stripe · ComfyUI (local portrait workflows,
  SFW + NSFW variants) · edge-tts / Kokoro (TTS) · (later) age verification
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

Memory is hybrid: a rolling summary + durable facts + entity memory + episodic
segments, retrieved by lexical similarity with importance and recency weighting
(no vector store yet) and persisted per (player, companion) in Postgres.

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

## 7. File map (current code layout)

```
everheart/
├── README.md                    # includes homepage screenshot
├── screenshots/home.png         # recapture: pnpm screenshot:home
├── TECHNICAL_DESIGN.md
├── prisma/schema.prisma         # Supabase Postgres, eh_* tables
├── scripts/
│   ├── comfyui/
│   │   ├── companions.json                 # roster + prompts + seeds
│   │   ├── workflow-portrait.json          # SFW portrait workflow (majicmix)
│   │   └── workflow-nsfw.json              # 18+ workflow (epicrealism Natural Sin)
│   ├── generate-companion-portraits.mjs    # ComfyUI runner (--companion <id>)
│   ├── seed-companions-db.ts               # persist roster to eh_companion
│   ├── tts_local_server.py                 # local Kokoro TTS fallback
│   ├── screenshot.mjs / screenshot.config.mjs
│   ├── test-creation-pipeline.ts
│   └── unit-tests.ts
├── public/
│   ├── companions/                 # generated portraits + Ken Burns clips
│   ├── icons/                      # PWA PNG icons (192/512/maskable/apple)
│   └── sw.js                       # offline service worker
└── src/
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css  # homepage companion gallery
    │   ├── icon.svg                           # favicon (rose heart)
    │   ├── manifest.ts                        # PWA web app manifest
    │   ├── chat/page.tsx                      # redirect → first companion
    │   ├── chat/[companionId]/page.tsx        # chat UI (mp4 header avatar)
    │   ├── create/page.tsx                    # companion creation flow
    │   └── api/
    │       ├── create/route.ts
    │       ├── chat/route.ts                  # streaming orchestrator
    │       ├── tts/route.ts                   # edge-tts / local fallback
    │       ├── companions/route.ts            # roster CRUD
    │       ├── companions/[id]/portrait/route.ts  # auto portrait on create
    │       └── entitlements/{checkout,webhook}/route.ts
    ├── components/
    │   ├── AgeGate.tsx
    │   ├── PwaRegister.tsx                    # service worker registration
    │   └── chat/{ChatInput,ChatMessage,CompanionSidebar,CompanionProfile}.tsx
    ├── lib/
    │   ├── llm/{deepseek,creation-pipeline,chat-orchestrator}.ts
    │   ├── memory/{context-assembler,fact-extractor,memory-store,retrieval}.ts
    │   ├── payments/stripe.ts
    │   ├── cards/export.ts
    │   ├── db/client.ts
    │   ├── demo-companions.ts                 # bundled roster fallback
    │   ├── offline/{brain,persona}.js         # offline chat/creation fallback
    │   ├── speech.ts                          # streaming subtitle splitter
    │   └── tts.ts
    └── types/character-card.ts
```

## 8. How to run the POC

1. `cd everheart && pnpm install`
2. Copy `.env.example` → `.env.local` and fill keys
3. Supabase Postgres is configured via `DATABASE_URL` (pooler 6543, runtime)
   and `DIRECT_URL` (5432, migrations) — tables are created with the `eh_` prefix
4. `pnpm prisma generate && pnpm prisma db push`
5. `pnpm dev`
6. Optional: seed the demo roster into the DB — `pnpm db:seed-companions`
7. Test pipeline: `DEEPSEEK_API_KEY=... pnpm pipeline:test`
8. Voice: install the local Kokoro fallback once
   (`python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro soundfile onnxruntime "misaki[zh]"`);
   set `EVERHEART_TTS_MODE=local` to force local voices, or keep `auto`
   (edge → local Kokoro → cloud). Use Python 3.12 if the wheels fail to build
   on the default `python3`.
9. Portraits: run ComfyUI on http://127.0.0.1:8188, then
   `node scripts/generate-companion-portraits.mjs` (all) or
   `node scripts/generate-companion-portraits.mjs --companion <id>` (single)

## 9. Immediate next implementation steps (current status)

Implemented so far: creation pipeline, streaming chat UI, roster in Supabase,
local ComfyUI portraits (SFW + NSFW workflows) with 3s Ken Burns clips, voice
(edge-tts + local Kokoro fallback), streaming speech + subtitles with gapless
prefetched playback, long-sentence chunking, and silence-trimmed clips (only
`*...*` narration is stripped from voice), continuous STT, markdown/emoji
bubbles, companion intro card + blurred video backdrop, favicon, AgeGate.
Companion memory (facts / entities / episodes with importance+recency
retrieval, visible via the 🧠 panel) is server-persisted and offline-first:
Supabase is the durable copy, `localStorage` is the mirror that keeps the
offline brain working. Anonymous `playerId` stands in for auth for now.

Done since this draft: message history and memory now live in Postgres
(`eh_message`, `eh_memory_fact` / `eh_memory_entity` / `eh_memory_episode`,
`eh_summary`), with privacy endpoints (`/api/memory*`) and JSON / Markdown
exports. Vector retrieval is deliberately deferred — lexical recall is enough
at current fact counts (`docs/memory-plan.md` §3 P3).

Still to do:
1. Auth (Clerk or NextAuth) + protect API routes; migrate `playerId` rows onto
   real user ids
2. Model tiering / BYOK routing (the DeepSeek client and `MODEL_LADDER` exist,
   but every tier still resolves to one model)
3. Credit balance check before LLM calls
4. Real age verification (Veriff / Stripe Identity) replacing the checkbox gate
5. Stripe test mode + success page (checkout/webhook exist)
6. Cloud portrait workers (fal / Replicate) for scale
7. Serve NSFW assets behind an authed route (they currently live in `public/`;
   the public homepage already shows SFW alternates for 18+ roles)

## 10. Later (phase 2+)

- Full vector retrieval with embeddings
- Voice packs (XTTS / ElevenLabs cloning; edge-tts + Kokoro already in place)
- Cloud portrait workers (fal / Replicate; local ComfyUI is the MVP path)
- Creator marketplace + Stripe Connect
- Tauri desktop shell
- PWA offline / install prompts
