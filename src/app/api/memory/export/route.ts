/**
 * GET /api/memory/export?playerId=&companionId=
 *
 * Downloads everything stored about this (player, companion) pair as a JSON
 * file — the data-portability half of the "AI companions you own forever"
 * promise, and the counterpart to the Markdown memory export in the UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { sanitizePlayerId } from "@/lib/auth/player";
import { loadServerMemory } from "@/lib/memory/server-store";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const playerId = sanitizePlayerId(params.get("playerId"));
  const companionId = String(params.get("companionId") || "").trim();
  if (!playerId || !companionId) {
    return NextResponse.json({ error: "playerId and companionId required" }, { status: 400 });
  }

  try {
    const memory = await loadServerMemory(playerId, companionId);
    const payload = {
      exportedAt: new Date().toISOString(),
      playerId,
      companionId,
      memory: memory ?? null,
    };
    const filename = `everheart-memory-${companionId}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[memory:export]", err?.message || err);
    return NextResponse.json({ error: "failed to export memory" }, { status: 500 });
  }
}
