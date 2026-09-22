/**
 * GET /api/companions/:id/messages?playerId=&limit=
 *   -> { messages: [{ id, role, content, createdAt }] }
 *
 * Server-side chat history (Phase P1). The chat page loads from here first and
 * falls back to its localStorage copy when the request fails, so offline use
 * keeps working.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sanitizePlayerId } from "@/lib/auth/player";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companionId } = await params;
  const search = req.nextUrl.searchParams;
  const playerId = sanitizePlayerId(search.get("playerId"));
  if (!playerId || !companionId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }
  const requested = Number(search.get("limit"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIMIT)
  );

  try {
    // Newest N, returned in chronological order for direct rendering.
    const rows = await prisma.message.findMany({
      where: { userId: playerId, companionId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return NextResponse.json({
      messages: rows.reverse().map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error("[messages:get]", err?.message || err);
    return NextResponse.json({ error: "failed to load messages" }, { status: 500 });
  }
}
