/**
 * GET    /api/memory?playerId=&companionId=   -> { memory: CompanionMemory | null }
 * PUT    /api/memory  { playerId, companionId, memory, companionName?, isNsfw? }
 * DELETE /api/memory?playerId=&companionId=   -> clears facts/entities/episodes/summary
 *
 * The client keeps localStorage as its offline copy and working state; this is
 * the durable store behind it. Full-blob replace semantics on PUT (see
 * lib/memory/server-store.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { ensurePlayer, sanitizePlayerId } from "@/lib/auth/player";
import {
  deleteServerMemory,
  ensureCompanionRow,
  loadServerMemory,
  saveServerMemory,
} from "@/lib/memory/server-store";
import type { CompanionMemory } from "@/lib/memory/memory-store";

const MAX_FACTS = 200;
const MAX_ENTITIES = 100;
const MAX_EPISODES = 100;

function sanitizeCompanionId(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}

/** Trust nothing from the wire: clamp sizes and drop malformed entries. */
function sanitizeMemory(raw: any): CompanionMemory {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    version: 2,
    updatedAt: Date.now(),
    summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 4000) : "",
    messageCount: Math.max(0, Number(raw?.messageCount) || 0),
    lastSummaryAt: Math.max(0, Number(raw?.lastSummaryAt) || 0),
    userProfile: arr(raw?.userProfile)
      .filter((f: any) => f && typeof f.text === "string" && f.text.trim())
      .slice(0, MAX_FACTS)
      .map((f: any) => ({
        text: String(f.text).slice(0, 500),
        importance: Math.min(1, Math.max(0, Number(f.importance) || 0.6)),
        createdAt: Number(f.createdAt) || Date.now(),
        lastUsedAt: Number(f.lastUsedAt) || Date.now(),
      })),
    entities: arr(raw?.entities)
      .filter((e: any) => e && typeof e.name === "string" && e.name.trim())
      .slice(0, MAX_ENTITIES)
      .map((e: any) => ({
        name: String(e.name).slice(0, 120),
        note: String(e.note || "").slice(0, 300),
        importance: Math.min(1, Math.max(0, Number(e.importance) || 0.6)),
        lastSeenAt: Number(e.lastSeenAt) || Date.now(),
      })),
    episodes: arr(raw?.episodes)
      .filter((e: any) => e && typeof e.summary === "string" && e.summary.trim())
      .slice(0, MAX_EPISODES)
      .map((e: any) => ({
        summary: String(e.summary).slice(0, 600),
        keywords: arr(e.keywords).slice(0, 12).map((k: any) => String(k).slice(0, 40)),
        importance: Math.min(1, Math.max(0, Number(e.importance) || 0.6)),
        startAt: Number(e.startAt) || Date.now(),
        endAt: Number(e.endAt) || Date.now(),
      })),
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const playerId = sanitizePlayerId(params.get("playerId"));
  const companionId = sanitizeCompanionId(params.get("companionId"));
  if (!playerId || !companionId) {
    return NextResponse.json({ error: "playerId and companionId required" }, { status: 400 });
  }
  try {
    const memory = await loadServerMemory(playerId, companionId);
    return NextResponse.json({ memory });
  } catch (err: any) {
    console.error("[memory:get]", err?.message || err);
    return NextResponse.json({ error: "failed to load memory" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const companionId = sanitizeCompanionId(body.companionId);
    const playerId = await ensurePlayer(body.playerId);
    if (!companionId) {
      return NextResponse.json({ error: "companionId required" }, { status: 400 });
    }
    await ensureCompanionRow(playerId, companionId, body.companionName, body.isNsfw);
    await saveServerMemory(playerId, companionId, sanitizeMemory(body.memory));
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    const bad = err?.message === "invalid playerId";
    console.error("[memory:put]", err?.message || err);
    return NextResponse.json(
      { error: bad ? "invalid playerId" : "failed to save memory" },
      { status: bad ? 400 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const playerId = sanitizePlayerId(params.get("playerId"));
  const companionId = sanitizeCompanionId(params.get("companionId"));
  if (!playerId || !companionId) {
    return NextResponse.json({ error: "playerId and companionId required" }, { status: 400 });
  }
  try {
    await deleteServerMemory(playerId, companionId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[memory:delete]", err?.message || err);
    return NextResponse.json({ error: "failed to clear memory" }, { status: 500 });
  }
}
