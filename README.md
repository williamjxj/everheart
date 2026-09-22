# Everheart — AI Companions You Own Forever

**Working title · Generative AI companion app · One-time payment · 18+ optional**

Create or buy AI companions (chat, portrait, voice, long-term memory) for a one-time price. Adult content supported behind verified 18+ checks.

<!-- screenshots -->
## Screenshots

| Everheart homepage |
| --- |
| ![Everheart homepage](screenshots/home.png) |

<!-- /screenshots -->

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
`eh_companion`, `eh_message`, `eh_memory_fact`, `eh_memory_entity`,
`eh_memory_episode`, `eh_summary`, `eh_entitlement`, `eh_ledger_entry`,
`eh_character_card_template`). `DATABASE_URL` points at the transaction-mode
pooler (6543) for runtime; `DIRECT_URL` (5432) is used for schema changes.

**Schema changes do not go through `prisma db push` in this project** — push
introspects the database first, and the Supabase instance also holds another
project's tables with a cross-schema FK (`public.dr_users` → `auth.users`),
which fails with P4002. Prisma CLI also only reads `.env` (not `.env.local`),
so keep a local `.env` (gitignored) alongside it. The workflow is:

```bash
cp -n .env.local .env                       # Prisma CLI reads .env only
node --env-file=.env scripts/db-inspect.mjs # check current tables/columns/row counts
npx prisma db execute --file prisma/sql/<migration>.sql --schema prisma/schema.prisma
npx prisma generate
```

### Environment Variables

See `.env.example`.

### Core Features in this MVP

1. **Companion Creation Pipeline** – multi-stage LLM chain producing a SillyTavern-compatible character card
   (falls back to the deterministic offline generator without a key)
2. **Chat with Memory** – streaming replies + rolling summaries + facts/entities/episodes,
   persisted in Supabase per anonymous player (see feature 14); offline rule-based replies
   when DeepSeek is unavailable
3. **Entitlements** – one-time license unlocks credits / features
4. **BYOK** – bring your own DeepSeek key
5. **Card Import/Export** – V2/V3 JSON + PNG metadata support (basic)
6. **18+ AgeGate** – NSFW companions are gated behind an age confirmation
   (demo; replace with real identity verification before production)
7. **Character portraits** – 10 demo companions (Elena, Kai, Lyra, Mira,
   Dante, Yuna, Cassian, Nova, Sienna, Raven) with locally generated
   portraits (ComfyUI) in `public/companions/` (portrait + alternate + a 3s
   Ken Burns video clip each). Regenerate with:
   `node scripts/generate-companion-portraits.mjs` (requires ComfyUI on
   http://127.0.0.1:8188; workflow + roster in `scripts/comfyui/`).
   18+ companions can opt into a dedicated NSFW workflow
   (`"workflow": "nsfw"` in `companions.json`, using the
   epicrealism Natural Sin checkpoint) so their portraits are genuinely
   adult-only — Lyra, Sienna, and Raven are wired this way.
8. **Voice chat (EN / 中文)** – every companion speaks: `/api/tts` renders
   replies with Microsoft neural voices via `uvx edge-tts` (per-companion
   en/zh voice + rate, cached by content hash). The chat input has a mic
   button (Web Speech API, Chrome/Edge), an EN/中文 toggle that switches both
   speech recognition and the reply voice, and a speaker toggle to mute.
   Recognition runs in continuous mode and keeps accumulating final results,
   so long sentences / dictation aren't cut off at the first pause. Voices and
   rates are per-companion (applied even when the roster loads from the DB).
   Stage directions wrapped in a single `*...*` are treated as narration and
   skipped by voice — nothing else is dropped (`**bold**`, quoted dialogue,
   links, and code keep their text). Requires `uvx` and internet access to
   Microsoft's TTS service. Long replies are chunked per sentence, and
   over-long sentences are split so every TTS request stays under the provider
   limit. UI-created companions get a gender-matched en/zh/local voice
   (male/female pools chosen at creation); older characters missing a voice
   are repaired automatically by the registry on load.
9. **Streaming speech + subtitles** – replies are spoken sentence-by-sentence
   as they stream in (no waiting for the full reply), and the currently spoken
   sentence is highlighted inside the bubble. Clips are synthesized *ahead* of
   playback (several in parallel) and are trimmed of leading/trailing silence,
   so sentences flow continuously with no pause between them.
   **Offline voices**: a local
   Kokoro TTS server (`scripts/tts_local_server.py`, EN + 中文) kicks in
   automatically when the network path fails. Chat bubbles render **markdown**
   (bold, italic, code, links, lists) and **emoji**, with spoken sentences
   highlighted as subtitles — install the local voices once with:

   ```bash
   python3 -m venv .venv-tts
   .venv-tts/bin/pip install kokoro soundfile onnxruntime "misaki[zh]"
   ```

   The first local generation downloads the Kokoro-82M model (needs network
   once); afterwards it works fully offline. Set `EVERHEART_TTS_MODE=local`
   to force local voices, or keep `auto` (edge → local → cloud fallback).
   On macOS the Homebrew `python3` can be too new for the Kokoro wheels —
   create `.venv-tts` with Python 3.12 if the install fails.
10. **Characters as Markdown (SOUL.md)** – every companion is one
    hand-editable Markdown file (the single source of truth): the bundled
    demo companions (currently 10) live next to their portraits in `public/companions/<name>/demo-<name>.md`
    (e.g. `public/companions/mira/demo-mira.md`), and user-created characters
    are saved as md in IndexedDB (`user-*.md`). The home showcase and chat
    load the roster from the md registry (bundled + IndexedDB merged at
    runtime, bundled md precached offline); created companions are also
    upserted to `eh_companion`. Conversation data (messages + memory) is
    persisted server-side per player and mirrored in `localStorage` for the
    offline path — see feature 14.
11. **Portraits in the UI** – the home page showcases every companion with
    their generated portrait; hovering a card or sidebar entry plays the 3s
    Ken Burns video clip, and the chat screen keeps it alive in the header
    avatar (autoplay, muted, looping). A homepage screenshot lives in
    `screenshots/home.png` (shown at the top of this README). Recapture with
    the app running (`pnpm screenshot:home`, default http://localhost:4904).
    Because the homepage is public, 18+ companions show their SFW alternate
    shot there (Lyra: `/companions/lyra/alternate.png`); the adult portrait
    and clip only appear inside the age-gated chat. Inside a chat, the
    companion's clip also runs as a soft blurred backdrop, and a collapsible
    intro card shows their living portrait, age, tags, and description so you
    always know who you're talking to.
12. **Auto portrait for created companions** – the create flow generates a
    portrait with the local ComfyUI (`POST /api/companions/:id/portrait`,
    reusing `scripts/comfyui/workflow-portrait.json`), writes it to
    `public/companions/<id>/portrait.png`, builds the matching 3s Ken Burns
    clip (`portrait.mp4`), and persists the URL both to `eh_companion` and
    back into the companion's IndexedDB md so chat/home pick it up
    automatically. Portrait prompts are gender-explicit ("a man / a woman")
    so the generated face matches the character.
13. **PWA / offline** – the app is installable on mobile (web app manifest,
    PNG + maskable icons, apple-touch icon) and a service worker precaches the
    app shell plus every demo chat page. Companion portraits are cached at
    runtime, chat history and memory are mirrored in `localStorage` so the
    offline brain keeps chatting without a network connection (the server copy
    is authoritative when reachable), and the app keeps working with no
    network at all. Force-enable in dev with `?pwa=1`.
14. **Companion memory** – each companion builds a real memory of you over
    time (inspired by Hermes Agent + CrewAI): durable facts ("User likes
    hiking"), entity memory ("Buddy: User's dog"), and episodic memory
    (auto-compacted past conversations). On every message the most relevant
    facts, entities, and recalled moments are retrieved (importance + recency
    scoring) and injected into the reply context, so the companion actually
    remembers what you told it. Since the P1 pass the memory is **stored
    server-side** (`eh_memory_fact` / `eh_memory_entity` / `eh_memory_episode`
    + `eh_summary`, keyed by an anonymous `playerId`) and mirrored in
    `localStorage`, so it survives a cleared browser or another device; the
    offline path keeps working unchanged.

    - **Extraction** runs in two passes after each reply: rule-based (offline,
      instant) and an LLM pass (`POST /api/memory/extract`) that also refreshes
      the rolling summary every 20 exchanges. The LLM call is merged into one
      request and only runs for turns that can carry facts (pure "ok" /
      "哈哈"-style turns are skipped).
    - **Boundaries** — anything you ask it to stop doing is stored with a
      `Boundary:` prefix and always injected into the prompt, ahead of
      relevance-ranked facts, so it can't be crowded out.
    - Open the 🧠 记忆 panel to see what it remembers: user-set boundaries get
      their own section and every fact has a ✕ to forget it individually.
      "清空记忆" clears both the local and the server copy, and memory can be
      exported as JSON (`GET /api/memory/export`) or as a Markdown snapshot
      (`<id>.memory.md`, Hermes USER.md-style).

### Roadmap Status

- [x] Project skeleton & schema
- [x] Creation pipeline (LLM stages + Zod)
- [x] Offline creation + chat fallback (merged from codex-everheart)
- [x] Chat orchestration + memory helpers
- [x] Stripe entitlement stubs
- [x] 18+ AgeGate (demo confirmation)
- [x] Server-side message + memory persistence (anonymous `playerId`; see
      `docs/memory-plan.md` P1) — history and memory survive a cleared browser
- [x] Memory privacy controls (forget one fact, clear, boundary section, JSON export)
- [ ] Real auth (Clerk) — migrate `playerId` rows onto real user ids
- [ ] Vector retrieval (deferred until lexical recall measurably falls short)
- [ ] Full UI polish
- [ ] Production age verification
- [ ] Portrait / voice workers
- [ ] Marketplace (phase 2)

### Keep Supabase from pausing (free plan)

Free Supabase projects pause after ~2 weeks without database activity. The
keep-alive script touches every configured project weekly so none go idle.
The script lives at `~/my-tools/bin/keepalive-db.mjs`. With no arguments it
keeps both known projects alive; you can also pass one or more project
directories to override. Each project
reads its own `.env.local` and uses whatever credentials it has:
everheart → Prisma `SELECT 1` via `DATABASE_URL`; jobPilot →
PostgREST read on `jp_profiles` via `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`.

```bash
# one-time install (Monday 04:17, logs to /tmp/keepalive-db.log)
(crontab -l 2>/dev/null | grep -v 'keepalive-db.mjs'; echo '17 4 * * 1 /opt/homebrew/bin/node /Users/william.jiang/my-tools/bin/keepalive-db.mjs /Users/william.jiang/my-business/everheart /Users/william.jiang/my-tests/my-cv/jobPilot >> /tmp/keepalive-db.log 2>&1') | crontab -

# manual smoke test
node /Users/william.jiang/my-tools/bin/keepalive-db.mjs
```

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
