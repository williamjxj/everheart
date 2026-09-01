# Everheart — Memory Borrowing Map

**What Everheart can borrow from Hermes Agent and CrewAI — and what we already did.**

Everheart's companion memory was rebuilt from scratch by studying two systems:

- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** (Nous Research) — bounded, curated
  memory (`MEMORY.md` + `USER.md`), four memory types, a provider lifecycle
  (`prefetch` / `sync_turn`), capacity management, and clear "save vs skip" rules.
- **[CrewAI](https://docs.crewai.com/concepts/memory)** — a unified memory with LLM analysis on save,
  composite recall scoring (similarity + recency + importance), atomic fact
  extraction, entity memory, hierarchical scopes, and consolidation.

The graphic below summarizes the map — open
[memory-borrowing-diagram.html](memory-borrowing-diagram.html) to see it as a
hand-drawn, animated chart.

## Borrow map

| # | Idea | From | Status in Everheart | Notes |
|---|------|------|--------------------|-------|
| 1 | Bounded, curated memory | Hermes | ✅ Done | Per-companion store with importance + pruning (`memory-store.ts`) |
| 2 | Atomic fact extraction | CrewAI | ✅ Done | Rule-based offline (`fact-extractor.ts`); LLM function exists |
| 3 | Entity memory | CrewAI | ✅ Done | "Buddy: User's dog" captured per message |
| 4 | Episodic memory | Both | ✅ Done | Every 8 exchanges auto-compacted into episodes |
| 5 | Importance + recency recall | CrewAI | ✅ Done | Lexical composite scoring (`retrieval.ts`) |
| 6 | Save vs skip guidance | Hermes | ✅ Done | Conservative rules avoid junk facts |
| 7 | Memory visibility | CrewAI | ✅ Done | 🧠 panel shows facts / entities / episodes |
| 8 | Consolidation when full | Hermes + CrewAI | 🔜 Next | LLM keep / update / delete on near-duplicates |
| 9 | Memory commands ("remember / forget") | Hermes | 🔜 Next | `remember that …` / `forget …` in chat |
| 10 | Frozen session snapshot | Hermes | 🔜 Next | Capture the memory block once per session (prefix-cache friendly) |
| 11 | Injection guard | Hermes | 🔜 Next | Scan memory entries before they enter the prompt |
| 12 | Scopes / contextual memory | CrewAI | 🧭 Later | Per-topic branches (e.g. `/user/work`, `/relationship`) |
| 13 | Knowledge / training mode | CrewAI | 🧭 Later | Teach the companion backstory or fixed knowledge |
| 14 | Behavioral user model | Hermes (Honcho) | 🧭 Later | Long-term profile beyond discrete facts |
| 15 | Multi-provider routing | Hermes | 🧭 Later | Only relevant if we add cloud memory sync |

## Principles borrowed (the why)

- **Memory is bounded and curated, not a log.** Hermes enforces character limits
  and consolidates; Everheart prunes by importance and caps each store.
- **Save atomically, recall selectively.** CrewAI extracts discrete facts after
  every turn; only the most relevant items are injected before the next turn.
- **Score recall like a human memory.** Similarity + recency decay + importance,
  with the reasons available (CrewAI's `match_reasons` → our 🧠 panel).
- **Offline-first and private.** All memory lives in the browser
  (`localStorage`), per companion, never uploaded.

## Architecture today

```
chat exchange
   │
   ▼
extract (rules) ──► facts + entities            ──┐
   │                                             │
   ▼                                             ▼
every 8 messages: compress ──► episodes   per-companion memory store
                                              (userProfile / entities / episodes)
   │                                             │
   ▼                                             ▼
next message ──► retrieve (similarity+recency+importance)
   │                                             │
   ▼                                             ▼
/api/chat body ──► assembleContext ──► system prompt memory block
```

Key files:

- `src/lib/memory/memory-store.ts` — persistence, dedupe, pruning, limits
- `src/lib/memory/fact-extractor.ts` — rule-based facts / entities / episodes
- `src/lib/memory/retrieval.ts` — composite scoring + `bundleForQuery`
- `src/lib/memory/context-assembler.ts` — memory block in the system prompt
- `src/components/chat/MemoryPanel.tsx` — the 🧠 panel

## Suggested next work

**P1 (quick wins, high value)**

1. Server-side LLM extraction (`POST /api/memory/extract`) so memories are richer
   when a key is configured, with rule-based fallback offline.
2. Consolidation: when a new fact is ~similar to an old one, let the LLM decide
   keep / update / delete (CrewAI's `consolidation_threshold`).
3. Chat commands: "remember that …" always saves; "forget X" removes matching
   entries (Hermes `memory` tool semantics).
4. Injection guard: reject prompt-injection / credential-like patterns before a
   memory entry is stored or injected.

**P2 (later)**

5. Scopes: per-topic memory branches (`/user/work`, `/relationship`, …).
6. Knowledge / training mode: companion-owned facts the user can teach.
7. Real embeddings for semantic recall when online; keep the lexical scorer as
   the offline fallback.
