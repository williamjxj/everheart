/**
 * POST /api/chat
 * Body: {
 *   companionId?: string,
 *   card: CharacterCard,
 *   messages: {role, content}[],
 *   summary?: string,
 *   facts?: string[],
 *   userMessage: string,
 *   userApiKey?: string,
 *   isAdultVerified?: boolean
 * }
 *
 * For MVP we accept the card + memory in the request body
 * (later load from DB by companionId).
 */

import { NextRequest, NextResponse } from "next/server";
import { CharacterCardSchema } from "@/types/character-card";
import { generateReply, streamReply } from "@/lib/llm/chat-orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, userApiKey, isAdultVerified = false, stream = false } = body;

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
      authorsNote: body.authorsNote as string | undefined,
    };

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const token of streamReply({
              card: cardResult.data,
              memory,
              userMessage,
              userApiKey,
              isAdultVerified,
            })) {
              controller.enqueue(encoder.encode(token));
            }
            controller.close();
          } catch (e: any) {
            controller.enqueue(encoder.encode(`\n[Error] ${e.message}`));
            controller.close();
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
