/**
 * POST /api/memory/extract
 * Body: {
 *   userMessage: string,
 *   assistantReply: string,
 *   existingFacts?: string[],
 *   previousSummary?: string,
 *   recentMessages?: { role, content }[],
 *   includeSummary?: boolean,
 *   userApiKey?: string
 * }
 * Returns: { facts: string[], summary?: string, engine: "deepseek" | "skipped" }
 *
 * The chat page calls this right after a streamed reply finishes.
 *
 * Why a separate request instead of next/server `after()`: `after()` runs once
 * the response is already sent, so it cannot hand data back to the caller.
 * Memory still lives in the browser (Phase P0), so the delta has to return to
 * the client. Once Phase P1 persists memory server-side, the same extraction
 * moves into `after()` on /api/chat and this endpoint becomes internal.
 *
 * This route never throws and never returns 5xx: the client already ran its
 * rule-based extractor, so a failure here must stay invisible to the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractMemoryDelta } from "@/lib/memory/fact-extractor-llm";
import { isFillerTurn } from "@/lib/memory/fact-extractor";

const MAX_FACTS_IN = 40;
const MAX_MESSAGES_IN = 40;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const userMessage = String(body.userMessage || "").slice(0, 4000);
    const assistantReply = String(body.assistantReply || "").slice(0, 8000);
    if (!userMessage || !assistantReply) {
      return NextResponse.json({ facts: [], engine: "skipped" });
    }
    // Pure filler can't carry durable facts — don't pay for the round trip.
    // A summary refresh is still worth it if one was due.
    if (isFillerTurn(userMessage) && body.includeSummary !== true) {
      return NextResponse.json({ facts: [], engine: "skipped" });
    }

    const existingFacts = (Array.isArray(body.existingFacts) ? body.existingFacts : [])
      .filter((f: unknown): f is string => typeof f === "string")
      .slice(0, MAX_FACTS_IN);

    const recentMessages = (Array.isArray(body.recentMessages) ? body.recentMessages : [])
      .filter(
        (m: any) =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
      .slice(-MAX_MESSAGES_IN)
      .map((m: any) => ({ role: String(m.role), content: String(m.content).slice(0, 2000) }));

    const delta = await extractMemoryDelta({
      userMessage,
      assistantReply,
      existingFacts,
      previousSummary:
        typeof body.previousSummary === "string" ? body.previousSummary : undefined,
      recentMessages,
      includeSummary: body.includeSummary === true,
      userApiKey: body.userApiKey,
    });

    const engine = delta.facts.length > 0 || delta.summary ? "deepseek" : "skipped";
    return NextResponse.json({
      facts: delta.facts,
      ...(delta.summary ? { summary: delta.summary } : {}),
      engine,
    });
  } catch (err: any) {
    console.error("[memory:extract]", err?.message || err);
    return NextResponse.json({ facts: [], engine: "skipped" });
  }
}
