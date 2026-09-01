/**
 * Offline lexical retrieval over companion memory.
 *
 * CrewAI-style composite scoring: similarity (token overlap) + recency decay
 * + importance. No vector store needed for the MVP — works fully offline.
 */

import type { CompanionMemory, EntityMemory, EpisodeMemory, MemoryItem } from "./memory-store";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "my", "your", "i", "you", "me", "we", "us", "is", "are", "was", "were",
  "it", "that", "this", "these", "those", "do", "does", "did", "not", "no",
  "really", "very", "just", "so", "about", "have", "has", "had", "been",
  "what", "when", "where", "how", "why", "can", "could", "would", "should",
  "will", "like", "know", "want", "get", "got", "talk", "talking", "tell",
  "say", "said", "one", "thing", "things", "today", "night", "morning",
  "hey", "hi", "hello", "ok", "okay", "yeah", "yes", "sure", "maybe",
]);

/** Tokenize latin words + CJK bigrams so Chinese queries match too. */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower
    .replace(/[a-z0-9]+|[^\u0000-\u007f]+/g, (m) => (m.length ? `${m} ` : ""))
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (const w of words) {
    if (/^[\u4e00-\u9fff]+$/.test(w)) {
      if (w.length === 1) tokens.push(w);
      else {
        tokens.push(w);
        for (let i = 0; i < w.length - 1; i++) tokens.push(w.slice(i, i + 2));
      }
    } else if (!STOPWORDS.has(w)) {
      tokens.push(w);
    }
  }
  return tokens;
}

export function recencyDecay(createdAt: number, now: number, halfLifeDays = 14): number {
  const ageDays = Math.max(0, now - createdAt) / 86_400_000;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function overlapScore(query: Set<string>, candidate: string[]): number {
  if (candidate.length === 0) return 0;
  let hits = 0;
  for (const t of candidate) if (query.has(t)) hits += 1;
  if (hits === 0) return 0;
  return hits / Math.sqrt(query.size * candidate.length);
}

export interface Scored<T> {
  item: T;
  score: number;
  reasons: string[];
}

function scoreText(
  query: Set<string>,
  text: string,
  importance: number,
  createdAt: number,
  now: number
): { score: number; reasons: string[] } {
  const sim = overlapScore(query, tokenize(text));
  if (sim === 0) return { score: 0, reasons: [] };
  const recency = recencyDecay(createdAt, now);
  const score = sim * 0.5 + importance * 0.3 + recency * 0.2;
  const reasons: string[] = [];
  if (sim > 0) reasons.push("semantic");
  if (recency > 0.8) reasons.push("recency");
  if (importance > 0.75) reasons.push("importance");
  return { score, reasons };
}

export function retrieveMemory(
  memory: CompanionMemory,
  query: string,
  opts: { maxFacts?: number; maxEntities?: number; maxEpisodes?: number } = {}
): {
  facts: Scored<MemoryItem>[];
  entities: Scored<EntityMemory>[];
  episodes: Scored<EpisodeMemory>[];
} {
  const now = Date.now();
  const q = new Set(tokenize(query));

  const facts = memory.userProfile
    .map((item) => {
      const { score, reasons } = scoreText(q, item.text, item.importance, item.lastUsedAt, now);
      return { item, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxFacts ?? 6);

  const entities = memory.entities
    .map((item) => {
      const { score, reasons } = scoreText(
        q,
        `${item.name} ${item.note}`,
        item.importance,
        item.lastSeenAt,
        now
      );
      return { item, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxEntities ?? 5);

  const episodes = memory.episodes
    .map((item) => {
      const { score, reasons } = scoreText(
        q,
        `${item.summary} ${item.keywords.join(" ")}`,
        item.importance,
        item.endAt,
        now
      );
      return { item, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxEpisodes ?? 2);

  return { facts, entities, episodes };
}

/** Top facts / entities / episodes as plain strings for the LLM context. */
export function bundleForQuery(
  memory: CompanionMemory,
  query: string
): { facts: string[]; entities: string[]; recalledEpisodes: string[] } {
  const { facts, entities, episodes } = retrieveMemory(memory, query, {
    maxFacts: 8,
    maxEntities: 6,
    maxEpisodes: 3,
  });
  return {
    facts: facts.map((r) => r.item.text),
    entities: entities.map((r) => `${r.item.name}: ${r.item.note}`),
    recalledEpisodes: episodes.map((r) => r.item.summary),
  };
}
