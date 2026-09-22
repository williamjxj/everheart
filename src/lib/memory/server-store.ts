/**
 * Server-side memory persistence (Phase P1).
 *
 * The client's `CompanionMemory` object stays the working shape — this module
 * just maps it onto normalized `eh_*` tables so memory survives a browser
 * change, a cache wipe, or a different device.
 *
 * Semantics: `saveServerMemory` is a **replace** inside one transaction. The
 * client owns the ordering/dedupe rules (see memory-store.ts) and always sends
 * the complete memory, so delete-then-insert is both simpler and idempotent —
 * a retried request cannot double-insert.
 *
 * Tables:
 *   eh_summary          one row per (user, companion); also the header holding
 *                       messageCount / lastSummaryAt, which exist before the
 *                       first summary is produced
 *   eh_memory_fact      durable facts (+ `category = "boundary"` for rules)
 *   eh_memory_entity    named people/things the companion knows
 *   eh_memory_episode   compacted past conversation segments
 */

import { prisma } from "@/lib/db/client";
import type { CompanionMemory } from "@/lib/memory/memory-store";

const BOUNDARY_PREFIX = /^\s*boundary\s*:/i;

function toDate(ms: number | undefined | null): Date {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n) : new Date();
}

/**
 * Companions normally already exist in `eh_companion` (the seeded demo roster),
 * but user-created ones live only in the browser registry — and the memory
 * tables have an FK to it. Upserting a minimal row keeps memory writes from
 * failing on a companion the server has never seen.
 */
export async function ensureCompanionRow(
  userId: string,
  companionId: string,
  name?: string | null,
  isNsfw?: boolean
): Promise<void> {
  const existing = await prisma.companion.findUnique({
    where: { id: companionId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.companion.create({
    data: {
      id: companionId,
      userId,
      name: String(name || companionId).slice(0, 120),
      // Placeholder card: the real definition lives in the client's md registry
      // and is re-sent with every chat request.
      cardJson: { name: String(name || companionId) },
      isNsfw: !!isNsfw,
    },
  });
}

/** Read a companion's memory for one user. Null when nothing is stored yet. */
export async function loadServerMemory(
  userId: string,
  companionId: string
): Promise<CompanionMemory | null> {
  const [header, facts, entities, episodes] = await Promise.all([
    prisma.summary.findUnique({ where: { userId_companionId: { userId, companionId } } }),
    prisma.memoryFact.findMany({
      where: { userId, companionId },
      orderBy: { lastAccessed: "desc" },
    }),
    prisma.memoryEntity.findMany({
      where: { userId, companionId },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.memoryEpisode.findMany({
      where: { userId, companionId },
      orderBy: { endAt: "desc" },
    }),
  ]);

  const empty =
    !header && facts.length === 0 && entities.length === 0 && episodes.length === 0;
  if (empty) return null;

  return {
    version: 2,
    updatedAt: header ? header.updatedAt.getTime() : Date.now(),
    summary: header?.content || "",
    userProfile: facts.map((f) => ({
      text: f.fact,
      importance: f.importance,
      createdAt: f.createdAt.getTime(),
      lastUsedAt: f.lastAccessed.getTime(),
    })),
    entities: entities.map((e) => ({
      name: e.name,
      note: e.note,
      importance: e.importance,
      lastSeenAt: e.lastSeenAt.getTime(),
    })),
    episodes: episodes.map((ep) => ({
      summary: ep.summary,
      keywords: ep.keywords ? ep.keywords.split(" ").filter(Boolean) : [],
      importance: ep.importance,
      startAt: ep.startAt.getTime(),
      endAt: ep.endAt.getTime(),
    })),
    messageCount: header?.messageCount ?? 0,
    lastSummaryAt: header?.lastSummaryAt ?? 0,
  };
}

/** Replace the stored memory for one (user, companion). Idempotent. */
export async function saveServerMemory(
  userId: string,
  companionId: string,
  memory: CompanionMemory
): Promise<void> {
  const facts = memory.userProfile.slice(0, 200);
  const entities = memory.entities.slice(0, 100);
  const episodes = memory.episodes.slice(0, 100);

  await prisma.$transaction(async (tx) => {
    await tx.memoryFact.deleteMany({ where: { userId, companionId } });
    await tx.memoryEntity.deleteMany({ where: { userId, companionId } });
    await tx.memoryEpisode.deleteMany({ where: { userId, companionId } });

    if (facts.length) {
      await tx.memoryFact.createMany({
        data: facts.map((f) => ({
          userId,
          companionId,
          fact: f.text,
          importance: f.importance,
          category: BOUNDARY_PREFIX.test(f.text) ? "boundary" : "fact",
          createdAt: toDate(f.createdAt),
          lastAccessed: toDate(f.lastUsedAt),
        })),
      });
    }
    if (entities.length) {
      await tx.memoryEntity.createMany({
        data: entities.map((e) => ({
          userId,
          companionId,
          name: e.name,
          note: e.note || "",
          importance: e.importance,
          lastSeenAt: toDate(e.lastSeenAt),
        })),
      });
    }
    if (episodes.length) {
      await tx.memoryEpisode.createMany({
        data: episodes.map((ep) => ({
          userId,
          companionId,
          summary: ep.summary,
          keywords: (ep.keywords || []).join(" "),
          importance: ep.importance,
          startAt: toDate(ep.startAt),
          endAt: toDate(ep.endAt),
        })),
      });
    }

    const header = {
      content: memory.summary || "",
      messageCount: memory.messageCount || 0,
      lastSummaryAt: memory.lastSummaryAt || 0,
      version: memory.version || 2,
    };
    await tx.summary.upsert({
      where: { userId_companionId: { userId, companionId } },
      update: header,
      create: { userId, companionId, ...header },
    });
  });
}

/** Forget everything stored for one companion (the "clear memory" action). */
export async function deleteServerMemory(userId: string, companionId: string): Promise<void> {
  await prisma.$transaction([
    prisma.memoryFact.deleteMany({ where: { userId, companionId } }),
    prisma.memoryEntity.deleteMany({ where: { userId, companionId } }),
    prisma.memoryEpisode.deleteMany({ where: { userId, companionId } }),
    prisma.summary.deleteMany({ where: { userId, companionId } }),
  ]);
}

/**
 * Forget a single fact. Facts are identified by text because that is the only
 * id the client's memory shape carries (and the client dedupes by text).
 */
export async function deleteServerFact(
  userId: string,
  companionId: string,
  fact: string
): Promise<number> {
  const result = await prisma.memoryFact.deleteMany({
    where: { userId, companionId, fact },
  });
  return result.count;
}
