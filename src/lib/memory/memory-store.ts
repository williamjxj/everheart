/**
 * Persistent companion memory (client-side, offline-first).
 *
 * Model borrowed from Hermes Agent (bounded, curated memory: user profile +
 * agent notes, injected as context) and CrewAI (atomic facts, entity memory,
 * episodic recall ranked by importance + recency).
 *
 * Storage: localStorage `everheart_mem_<companionId>` — conversations stay on
 * the device, exactly like the rest of Everheart's dynamic data.
 */

export interface MemoryItem {
  text: string;
  importance: number; // 0..1
  createdAt: number;
  lastUsedAt: number;
}

export interface EntityMemory {
  name: string;
  note: string;
  importance: number;
  lastSeenAt: number;
}

export interface EpisodeMemory {
  summary: string;
  startAt: number;
  endAt: number;
  keywords: string[];
  importance: number;
}

export interface CompanionMemory {
  version: 2;
  updatedAt: number;
  /** Rolling conversation summary (Hermes "notes" analog). */
  summary: string;
  /** Durable facts about the user / relationship (Hermes USER.md analog). */
  userProfile: MemoryItem[];
  /** Named entities the companion knows about. */
  entities: EntityMemory[];
  /** Compacted past conversation segments (episodic memory). */
  episodes: EpisodeMemory[];
  messageCount: number;
  lastSummaryAt: number;
}

export const MEMORY_LIMITS = {
  facts: 40,
  entities: 24,
  episodes: 24,
  summaryChars: 1600,
};

export function emptyMemory(): CompanionMemory {
  return {
    version: 2,
    updatedAt: Date.now(),
    summary: "",
    userProfile: [],
    entities: [],
    episodes: [],
    messageCount: 0,
    lastSummaryAt: 0,
  };
}

export function loadMemory(companionId: string): CompanionMemory {
  if (typeof window === "undefined") return emptyMemory();
  try {
    const raw = localStorage.getItem(`everheart_mem_${companionId}`);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2) {
      return {
        ...emptyMemory(),
        ...parsed,
        userProfile: Array.isArray(parsed.userProfile) ? parsed.userProfile : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
      };
    }
    // Migrate the legacy { facts: string[], summary } shape.
    const legacyFacts: unknown[] = Array.isArray(parsed?.facts) ? parsed.facts : [];
    const now = Date.now();
    return {
      ...emptyMemory(),
      summary: typeof parsed?.summary === "string" ? parsed.summary : "",
      userProfile: legacyFacts
        .map((text, i) => ({
          text: String(text),
          importance: 0.6,
          createdAt: now - i * 1000,
          lastUsedAt: now,
        }))
        .slice(0, MEMORY_LIMITS.facts),
    };
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(companionId: string, memory: CompanionMemory) {
  if (typeof window === "undefined") return;
  memory.updatedAt = Date.now();
  localStorage.setItem(`everheart_mem_${companionId}`, JSON.stringify(memory));
}

export function clearMemory(companionId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`everheart_mem_${companionId}`);
}

/** Add durable facts, dedupe exact duplicates, bump importance on re-mention. */
export function addFacts(memory: CompanionMemory, facts: string[], importance = 0.6) {
  const now = Date.now();
  for (const raw of facts) {
    const text = raw.trim();
    if (!text) continue;
    const existing = memory.userProfile.find(
      (f) => f.text.toLowerCase() === text.toLowerCase()
    );
    if (existing) {
      existing.lastUsedAt = now;
      existing.importance = Math.min(1, existing.importance + 0.1);
    } else {
      memory.userProfile.push({ text, importance, createdAt: now, lastUsedAt: now });
    }
  }
  pruneFacts(memory);
}

export function upsertEntity(
  memory: CompanionMemory,
  name: string,
  note: string,
  importance = 0.6
) {
  const key = name.trim();
  if (!key) return;
  const existing = memory.entities.find(
    (e) => e.name.toLowerCase() === key.toLowerCase()
  );
  const now = Date.now();
  if (existing) {
    existing.note = note.trim() || existing.note;
    existing.lastSeenAt = now;
    existing.importance = Math.min(1, existing.importance + 0.1);
  } else {
    memory.entities.push({
      name: key,
      note: note.trim(),
      importance,
      lastSeenAt: now,
    });
  }
  memory.entities.sort((a, b) => b.importance - a.importance);
  if (memory.entities.length > MEMORY_LIMITS.entities) {
    memory.entities.length = MEMORY_LIMITS.entities;
  }
}

export function pushEpisode(
  memory: CompanionMemory,
  summary: string,
  keywords: string[],
  importance = 0.6
) {
  const text = summary.trim();
  if (!text) return;
  const now = Date.now();
  memory.episodes.unshift({
    summary: text.slice(0, 400),
    startAt: now,
    endAt: now,
    keywords: keywords.slice(0, 10),
    importance,
  });
  if (memory.episodes.length > MEMORY_LIMITS.episodes) {
    memory.episodes.length = MEMORY_LIMITS.episodes;
  }
}

/** Keep memory bounded (Hermes-style capacity management): drop the weakest. */
function pruneFacts(memory: CompanionMemory) {
  const now = Date.now();
  memory.userProfile.sort((a, b) => {
    const ageA = now - a.lastUsedAt;
    const ageB = now - b.lastUsedAt;
    return b.importance - a.importance || ageA - ageB;
  });
  if (memory.userProfile.length > MEMORY_LIMITS.facts) {
    memory.userProfile.length = MEMORY_LIMITS.facts;
  }
}
