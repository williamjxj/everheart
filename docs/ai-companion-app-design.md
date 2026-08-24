# Everheart — AI companions you own forever

**Working title, single generative AI app · One-time-payment monetization · 18+ adult-optional companion space**

---

## 1. Executive summary

Everheart is a web app where users **create or buy AI companions** — chat, portrait, voice, and long-term memory — for a **one-time price instead of a subscription**. Adult (NSFW) content is supported behind verified 18+ identity checks, which is the fastest-paying segment in consumer AI. The app is deliberately built in the OnlyFans-shaped gap: instead of paying creators monthly, fans buy a character once and own it forever; instead of OnlyFans banning AI content, this is our own platform where AI companions are the product.

The wedge is simple and proven by research: the biggest complaints on Reddit about Character.AI and Replika are **filters, paywalls, and memory loss**; the fastest-growing apps (Janitor AI, Candy.ai, CrushOn) monetize uncensored companionship; and there is already a reported **hundreds-of-millions-of-dollars-per-year market** for one-time character-card sales around SillyTavern. Nobody has combined "buy once, own forever, unrestricted, deep memory, creator marketplace" into one polished product yet.

---

## 2. Why this app (what the research showed)

### 2.1 Market evidence

| Signal | What it means for us |
|---|---|
| NSFW AI chatbot market ~ **$400M/yr** (Dream Companion, Candy.ai, per AI Haven/TechCrunch) | Uncensored companionship has proven, large-scale willingness to pay |
| Consumer AI companion apps: **$82M in H1 2025 → $120M+ in FY2025**; 337 revenue apps, 128 launched in 2025; ~$200M expected in 2026 (TechCrunch data via Roborhythms) | Category is growing fast but still fragmented — room for a differentiated entrant |
| **Janitor AI**: 15M+ users, ~250K DAU, 70–80% female, 110–130M monthly visits, 3.3M+ community characters; monetizes with $9.99/mo + $99.99/yr + token packs | NSFW roleplay retains and converts at massive scale; a custom uncensored model (JLLM) was the answer to mainstream API bans |
| Character-card ecosystem: a reported **"hundreds of millions of dollars" annual transaction volume** around SillyTavern cards; creators sell card packs on Patreon, Gumroad, Ko-fi | One-time purchases of AI characters are already a real economy — we formalize it inside the app |
| Replika sells a **$299.99 lifetime plan**; AppSumo lifetime deals: Mootion reached ~$150K MRR; an indie case sold **$300K in 60 days** via a lifetime deal | One-time-payment sales work, especially as a launch channel |
| OnlyFans June 2026 policy: AI content allowed **only for verified creators, clearly labeled, no real-person impersonation, no minors**; Fanvue is more AI-creator-friendly | The "AI OnlyFans" gold rush exists, but ToS-compliant design is mandatory; owning the platform avoids the ban risk |

### 2.2 Reddit community signals

| Community | Role | What it tells us |
|---|---|---|
| r/SillyTavernAI | Power-user tooling hub | This audience buys/wants tooling, cards, backends — and hates low-effort promos |
| r/JanitorAI_Official | 18+ character platform, NSFW tagged | Proves demand for unrestricted roleplay + card ecosystems |
| r/chatbots | Comparison/discovery | The best place to reach people actively evaluating alternatives |
| r/CharacterAI (1.5M+ members) | Mainstream companion app | Constant complaints about the safety filter and memory limits — a ready-made migration audience |
| r/replika, r/NomiAI, r/KindroidAI | Relationship-style companions | Retention comes from memory and voice; users are emotionally invested and promo-wary |
| r/LocalLLaMA, r/KoboldAI | Open-model backends | Local/uncensored model stack is mature and loved |

**Core user pains found in these communities:** filter interruptions mid-scene, paywalls on features that used to be free, characters forgetting context, and no way to own characters or monetize them as a creator. Everheart is built to answer all four.

### 2.3 GitHub / open-source stack evidence

| Project | Stars | Role in our stack |
|---|---|---|
| SillyTavern | 32.5K | Dominant open roleplay frontend; defines the character-card format we import/export |
| ComfyUI | 129K | Image-generation engine for portraits/scenes |
| oobabooga textgen | 47.5K | Local LLM serving (self-host option) |
| RVC (voice conversion) | 37.7K | Voice cloning/voicepack pipeline |
| a16z companion-app | 6K | Reference stack for AI companions with memory |
| TauriTavern | 1.4K | SillyTavern rewritten in Tauri/Rust — desktop distribution trend |
| awesome-ai-companion | 500 | 157-entry index; the category is exploding (many self-hosted "AI girlfriend" stacks pushed this month) |

The pattern on GitHub this month is hobbyists assembling local AI-companion stacks (LLM + image + TTS + memory + Live2D). The polished, sold-as-a-product version of that stack is exactly the gap we fill.

---

## 3. The app

### 3.1 One-liner

**Create or buy AI companions — chat, portrait, voice, memory — one-time price, no subscription, adult content optional behind verified 18+.**

### 3.2 Target users

- **Primary:** 18+ consumers frustrated with Character.AI filters, Replika paywalls, or seeking unrestricted companionship (the Janitor/CrushOn/Candy crowd) who prefer paying once and owning the product.
- **Secondary (phase 2):** creators who want to sell AI characters and earn payouts — the OnlyFans model, but with AI companions as the content and no platform ban on AI.

### 3.3 Wedge vs competitors

| Competitor | Their model | Our wedge |
|---|---|---|
| Character.AI | Free + $9.99/mo, filtered, no NSFW | Unrestricted + pay once |
| Replika | $19.99/mo or $299.99 "lifetime" | Lower one-time price, deeper creation, no subscription |
| Janitor AI | Free/BYOK + $9.99/mo JLLM | Buy-once app + creator card store with payouts |
| Chub/Venus | Free library + $5–20/mo model access | Purchase cards outright, chat included |
| NovelAI | $10–25/mo, solo, no community | One-time, community marketplace |

### 3.4 Product hooks

1. **Own forever** — one payment, lifetime license.
2. **No filter wall** — adult content allowed after verified 18+.
3. **Deep creation** — persona, scenario, art, voice in minutes via AI-assisted pipelines.
4. **Private by default** — client-side encrypted chat history.
5. **BYOK or pay-as-you-go** — bring your own LLM key (zero cost for us) or buy token packs.
6. **Creator marketplace** — sell cards, earn payouts (phase 2).

---

## 4. Revenue model (one-time first)

| Stream | Product | Price |
|---|---|---|
| License | Starter / Standard / Creator (early-bird pricing) | $29 / $49 / $79 one-time |
| Token packs | 50K / 200K / 1M tokens (3–4x COGS) | $5 / $18 / $75 |
| Marketplace (phase 2) | Cards $2.99–$14.99; platform takes 25% | per sale |
| Launch channel | AppSumo lifetime deal + Gumroad + Stripe checkout | one-time |

**Unit economics (bundled credits, heavy user ~1M tokens/mo):**

| Item | Cost | Revenue |
|---|---|---|
| LLM tokens (permissive hosted model) | ~$0.25–0.60/user/mo | covered by license + packs |
| Image gen | ~$0.02–0.05/image | included in creation |
| TTS voice | ~$0.01/voicepack | included |
| BYOK user | $0 | $0 (license is pure margin) |

A $49 license covers roughly 6–12 heavy months of bundled usage; token packs monetize beyond that. COGS scales with credits, so margin stays healthy.

---

## 5. System architecture

```text
                    ┌─────────────────────────────────────────────┐
                    │                Everheart web app            │
                    │   Next.js (PWA) · Tauri desktop later       │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │   API gateway (auth, entitlements, billing) │
                    └───┬───────────┬───────────┬──────────┬──────┘
                        │           │           │          │
          ┌─────────────▼──┐  ┌─────▼─────┐ ┌───▼────┐ ┌───▼────────┐
          │  Job queue      │  │  LLM      │ │ Image  │ │  Payments  │
          │  (Redis/BullMQ) │  │  gateway  │ │ workers│ │  Stripe /  │
          └───────┬─────────┘  └─────┬─────┘ │ (Comfy │ │  Gumroad   │
                  │                  │       │  UI)   │ └────────────┘
                  │                  │       └───┬────┘
                  │                  │           │
          ┌───────▼──────────────────▼───────────▼──────┐
          │  Postgres + pgvector · Redis · S3 (R2)      │
          │  profiles · cards · memory · ledger · media │
          └─────────────────────────────────────────────┘

  External: OpenRouter/BYOK · permissive hosted models · local Ollama/vLLM
            Age verification (Yoti/Veriff/Stripe Identity) · moderation API
```

**Stack (solo-dev friendly):** Next.js + TypeScript · Postgres + pgvector · Redis · S3-compatible storage · BullMQ job queue · OpenRouter (BYOK) + permissive hosted providers + optional self-host · ComfyUI workers · XTTS/Kokoro TTS · Stripe + Gumroad · modular moderation/verification services.

---

## 6. Core workflows

### 6.1 Companion Creation Pipeline (chained LLM stages)

Each stage is a chained LLM call with a strict JSON schema; failure falls back to a cheaper model; the chain produces a portable character card.

```text
User picks archetype/vibe
        │
        ▼
[1] Persona brief          LLM → name, adult age, personality, speech style,
        │                  backstory, relationship dynamic, kinks/limits (JSON)
        ▼
[2] Scenario seeds         LLM → 5 opening scenes + 3 long-arc storylines
        │
        ▼
[3] Dialogue style pack    LLM → sample lines, catchphrases, narration voice
        │
        ▼
[4] Character card compile  merge JSON → SillyTavern/Chub-compatible card
        │                    (PNG-embedded metadata, import/export)
        ▼
[5] Portrait pipeline      ComfyUI → SFW portrait; NSFW variant behind 18+ gate
        │
        ▼
[6] Voice pack             TTS (XTTS/Kokoro) → voice samples, optional clone
        │
        ▼
   Asset bundle → user's collection / marketplace listing
```

**Design notes:** stages 1–4 run as a DAG with schema validation between hops (LLM JSON often needs repair — a small "validate + regenerate" step per stage). Stages 5–6 run asynchronously via the job queue. Cost per creation: roughly $0.10–0.50 LLM + $0.10 images + $0.05 voice — monetized through the license/packs, and creators pay a small listing fee in phase 2.

### 6.2 Chat Orchestration Loop

The chat runtime is an orchestrated loop (not a one-shot chain):

```text
User message
      │
      ▼
[Router]           entitlement → BYOK / bundled credits / model tier
      │
      ▼
[Context assembler]  character card + long-term memory (pgvector)
                     + rolling summaries + last N messages + author's note
      │
      ▼
[Generator]        stream reply · fallback ladder (premium → mid → local)
      │
      ▼
[Safety gate]       block minors/real-person likeness/illegal content;
                    allow adult fiction (18+ verified)
      │
      ▼
[Memory writer]     async: embed → store · trigger summary when context nears
                    limit · extract long-term facts (name, preferences, events)
      │
      ▼
[Enrichment]        optional TTS voice · optional image reply (ComfyUI)
```

**Design notes:** memory is the retention moat (Kindroid/Nomi prove it). We run a hybrid memory: vector retrieval + rolling summaries + a structured "relationship facts" table. The router enforces cost ceilings (per-user monthly token budget), and the fallback ladder keeps availability high without burning money.

### 6.3 Purchase & Entitlement Flow

```text
Checkout (Stripe/Gumroad, one-time) → webhook → entitlement server
        → license activated (Starter/Standard/Creator)
        → feature flags unlocked · wallet topped up with included credits
        → receipts + lifetime guarantee (no auto-renewal by definition)
```

Token packs mint credits into a per-user ledger; BYOK mode bypasses our wallet entirely. Marketplace purchases (phase 2) mint a permanent card license + rev share to the creator via Stripe Connect payouts.

### 6.4 Creator Marketplace Flow (phase 2, OnlyFans-style)

```text
Creator builds card (creation pipeline) → sets one-time price ($2.99–$14.99)
        → moderation review (likeness/CSAM/policy checks) → listing
        → buyer purchases → instant unlock + chat entitlement
        → payout to creator (75%) · platform keeps 25%
```

The operator seeds the first catalog with AI-generated companions so the marketplace is alive on day one (solves chicken-and-egg), then opens creator submissions with a payout program.

### 6.5 Safety & compliance pipeline (cross-cutting)

1. **Age gate** at signup; **ID verification** required for adult content (mirrors Janitor AI's Limitless Mode).
2. **No real-person likeness** — portrait pipeline blocks celebrity/real-person prompts (deepfake laws in 45+ states).
3. **No minors** — input/output classifier on chat and images; 45 states now criminalize AI CSAM; we add hashing + notice-and-takedown.
4. **AI disclosure** — all AI-generated companions labeled as AI (OnlyFans/Fanvue standard).
5. **Privacy** — encrypted chat history, no training on user chats, data export.
6. **Payment policy** — sell software via mainstream processors (allowed); defer adult-content marketplace payouts to processors that permit adult digital goods.

---

## 7. MVP scope + 90-day roadmap

| Weeks | Milestone | Exit criterion |
|---|---|---|
| 1–2 | Persona pipeline + SFW chat MVP (BYOK) | Create a character and chat coherently |
| 3–4 | 18+ gate + ID verification + bundled credits + one-time checkout | Pay once → NSFW unlock works |
| 5–6 | Portrait pipeline (ComfyUI) + voice (TTS) | Full media companion |
| 7–8 | Long-term memory (vector + summaries) | Character remembers across sessions |
| 9–10 | Card import/export (SillyTavern/Chub compatible) + starter card store | Interop with the existing ecosystem |
| 11–12 | Launch: AppSumo lifetime deal + Reddit/TikTok organic + SEO | First revenue |

**Realistic targets:** $300–1,000 in month 1; $5–10K by day 90; marketplace revenue after phase 2. The AppSumo channel alone has produced $300K-in-60-days outcomes for comparable AI tools, though typical results are far lower — treat it as the launch amplifier, not the plan.

---

## 8. Marketing & acquisition

- **Reddit playbook:** contribute real value first (free card packs, model comparisons, memory tips) in r/SillyTavernAI, r/chatbots, r/LocalLLaMA; disclose affiliation; never spam; use r/CharacterAI and r/replika as research only. This mirrors the AI-creator funnel that made money fast in the OnlyFans space — but compliant and on our own platform.
- **TikTok/X organic:** short "create your AI companion" clips and character showcase reels (non-explicit).
- **SEO:** "best AI companion one-time purchase", "uncensored AI chat no subscription", "own your AI girlfriend".
- **AppSumo lifetime deal** at launch for volume + social proof.
- **Creator affiliate program (phase 2):** 25–30% rev share to creators who attract buyers.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mainstream LLM APIs ban NSFW (OpenAI/Anthropic) | Use permissive hosted models or self-hosted open fine-tunes (Janitor AI built JLLM for exactly this reason); BYOK shifts cost/choice to users |
| Payment processors restrict adult marketplace | Sell one-time software via standard processors first; use adult-friendly processors for phase-2 payouts |
| Regulatory exposure (deepfakes, CSAM, disclosure) | Verified 18+, real-person-likeness ban, CSAM filtering, AI labeling, takedown process — non-negotiable from day one |
| One-time revenue + usage cost tension | BYOK default + token packs + per-user cost ceilings; license covers ~6–12 heavy months |
| Competition (free tools like SillyTavern) | Compete on polish, ownership, memory, marketplace payouts — not on "free" |
| App-store restrictions for adult content | Web-first (PWA) avoids store policy; desktop via Tauri later |

---

## 10. Sources

- AI Haven / TechCrunch: NSFW AI chatbot market ~$400M — https://aihaven.com/news/nsfw-ai-chatbot-market-400-million/
- Roborhythms: AI companion apps $120M+ in 2025, 337 apps — https://www.roborhythms.com/ai-companion-app-market-2026/
- Toolradar: AI roleplay landscape, pricing, filters — https://toolradar.com/guides/best-ai-roleplay-tools
- YFChuhai (AI新榜): Janitor AI data (15M users, 110M visits, 70–80% female, JLLM, pricing) — https://www.yfchuhai.com/article/10228364.html
- RedditMaster: AI roleplay/companion subreddit map & promo etiquette — https://www.redditmaster.com/best-subreddits/for-ai-roleplay
- AITNT News: character-card economy around SillyTavern (Patreon/Gumroad sellers) — http://api.aitntnews.com/newDetail.html?newId=25697
- Fizzly / China Press: OnlyFans AI content policy 2026 — https://www.fizzly.ai/blog/onlyfans-ai-content-policy-explained
- AVB: 2026 legal framework for AI adult content (45 states CSAM, deepfakes) — https://aivideobootcamp.com/blog/grok-nsfw-ai-influencers-adult-content-guide-2026/
- AppSumo: Mootion $150K MRR from lifetime deals — https://cms.appsumo.com/blog/mootion
- Indie Hackers: $300K in 60 days via AppSumo lifetime deal — https://www.indiehackers.com/post/we-sold-300k-in-60-days-fully-bootstrapped-oCUvueZVtzO8RLzCs0VA
- GitHub: SillyTavern, ComfyUI, textgen, RVC, a16z companion-app, TauriTavern, awesome-ai-companion (checked 2026-08-22)
