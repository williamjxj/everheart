/**
 * POST /api/chat
 * Body: {
 *   playerId?: string,        // anonymous player id; enables server-side history
 *   companionId?: string,
 *   card: CharacterCard,
 *   messages: {role, content}[],
 *   summary?: string,
 *   facts?: string[],
 *   entities?: string[],
 *   recalledEpisodes?: string[],
 *   userMessage: string,
 *   userApiKey?: string,
 *   isAdultVerified?: boolean
 * }
 *
 * For MVP we accept the card + memory in the request body
 * (later load from DB by companionId).
 *
 * Persistence (Phase P1): when playerId + companionId are present the user and
 * assistant turns are written to `eh_message` *after* the response is done
 * (`after()`), streaming or not, so the browser is no longer the only copy.
 * Failures are logged and swallowed — a chat reply must never fail because the
 * history write did.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { CharacterCardSchema } from "@/types/character-card";
import { generateReply, streamReply } from "@/lib/llm/chat-orchestrator";
import { prisma } from "@/lib/db/client";
import { ensurePlayer, sanitizePlayerId } from "@/lib/auth/player";

const MAX_MESSAGE_CHARS = 8000;
/** Give up waiting for a stream that the client abandoned mid-reply. */
const PERSIST_TIMEOUT_MS = 90_000;

/** Write both turns of one exchange. Never throws. */
async function persistExchange(
  playerId: string,
  companionId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  try {
    const userId = await ensurePlayer(playerId);
    const rows = [
      {
        userId,
        companionId,
        role: "user",
        content: userMessage.slice(0, MAX_MESSAGE_CHARS),
      },
    ];
    if (assistantReply) {
      rows.push({
        userId,
        companionId,
        role: "assistant",
        content: assistantReply.slice(0, MAX_MESSAGE_CHARS),
      });
    }
    await prisma.message.createMany({ data: rows });
  } catch (err: any) {
    console.error("[chat:persist]", err?.message || err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, userApiKey, isAdultVerified = false, stream = false } = body;
    const playerId = sanitizePlayerId(body.playerId);
    const companionId =
      typeof body.companionId === "string" && body.companionId.trim()
        ? body.companionId.trim().slice(0, 64)
        : null;
    const canPersist = !!(playerId && companionId);

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json({ error: "userMessage required" }, { status: 400 });
    }

    const cardResult = CharacterCardSchema.safeParse(body.card);
    if (!cardResult.success) {
      return NextResponse.json({ error: "Invalid character card" }, { status: 400 });
    }

    const memory = {
      summary: body.summary as string | undefined,
      recentMessages: (body.messages || []) as { role: string; content: string }[],
      facts: (body.facts || []) as string[],
      entities: (body.entities || []) as string[],
      recalledEpisodes: (body.recalledEpisodes || []) as string[],
      authorsNote: body.authorsNote as string | undefined,
    };

    if (stream) {
      // The stream resolves this promise when the last token is enqueued, so the
      // `after()` callback below knows the full reply without blocking output.
      let settle: (reply: string) => void = () => {};
      const finished = new Promise<string>((resolve) => {
        settle = resolve;
      });
      if (canPersist) {
        after(async () => {
          const reply = await Promise.race([
            finished,
            new Promise<string>((resolve) => setTimeout(() => resolve(""), PERSIST_TIMEOUT_MS)),
          ]);
          await persistExchange(playerId!, companionId!, userMessage, reply);
        });
      }

      // Streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let full = "";
          try {
            for await (const token of streamReply({
              card: cardResult.data,
              memory,
              userMessage,
              userApiKey,
              isAdultVerified,
            })) {
              full += token;
              controller.enqueue(encoder.encode(token));
            }
            controller.close();
          } catch (e: any) {
            try {
              controller.enqueue(encoder.encode(`\n[Error] ${e.message}`));
              controller.close();
            } catch {
              /* already closed by the client going away */
            }
          } finally {
            settle(full);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Non-streaming
    const result = await generateReply({
      card: cardResult.data,
      memory,
      userMessage,
      userApiKey,
      isAdultVerified,
    });

    if (canPersist) {
      await persistExchange(playerId!, companionId!, userMessage, result.reply);
    }

    return NextResponse.json({
      reply: result.reply,
      modelUsed: result.modelUsed,
      newFacts: result.newFacts,
    });
  } catch (err: any) {
    console.error("[chat]", err);
    return NextResponse.json(
      { error: err.message || "Chat failed" },
      { status: 500 }
    );
  }
}
