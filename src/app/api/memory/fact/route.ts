/**
 * DELETE /api/memory/fact  { playerId, companionId, fact }
 *
 * Removes exactly one remembered fact. Facts are keyed by their text because
 * that is the only identifier the client's memory shape carries.
 */

import { NextRequest, NextResponse } from "next/server";
import { sanitizePlayerId } from "@/lib/auth/player";
import { deleteServerFact } from "@/lib/memory/server-store";

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = sanitizePlayerId(body.playerId);
    const companionId = String(body.companionId ?? "").trim();
    const fact = String(body.fact ?? "").trim();
    if (!playerId || !companionId || !fact) {
      return NextResponse.json(
        { error: "playerId, companionId and fact required" },
        { status: 400 }
      );
    }
    const removed = await deleteServerFact(playerId, companionId, fact);
    return NextResponse.json({ ok: true, removed });
  } catch (err: any) {
    console.error("[memory:fact:delete]", err?.message || err);
    return NextResponse.json({ error: "failed to delete fact" }, { status: 500 });
  }
}
