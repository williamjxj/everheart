/**
 * POST /api/create
 * Body: { archetype, vibe?, nsfw?, extraNotes?, userApiKey? }
 * Returns the compiled character card + intermediate stages.
 */

import { NextRequest, NextResponse } from "next/server";
import { CreationInputSchema } from "@/types/character-card";
import { runCreationPipeline } from "@/lib/llm/creation-pipeline";
import { offlineCard } from "@/lib/offline/creation-fallback";
import {
  inferGender,
  voiceForCharacter,
} from "@/lib/tts/gender-voice";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreationInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const userApiKey = body.userApiKey as string | undefined;

    // TODO: check user entitlement / credit balance before running
    // TODO: deduct creation cost from ledger

    let result;
    try {
      result = await runCreationPipeline(parsed.data, userApiKey);
    } catch (err: any) {
      // No key / network failure / schema error → deterministic offline card
      console.warn(
        "[create] LLM pipeline unavailable — using offline fallback:",
        err?.message || err
      );
      const card = offlineCard(parsed.data);
      return NextResponse.json({
        success: true,
        card,
        voice: voiceForCharacter(
          card.name,
          card.everheart?.gender ??
            inferGender(`${card.description} ${card.personality}`)
        ),
        fallback: true,
      });
    }

    const voice = voiceForCharacter(
      result.card.name,
      result.persona.gender ??
        inferGender(
          `${result.card.description} ${result.card.personality} ${result.card.system_prompt ?? ""}`
        )
    );
    return NextResponse.json({
      success: true,
      card: result.card,
      voice,
      // Optionally return intermediate stages for debugging
      // persona: result.persona,
      // scenarios: result.scenarios,
      // dialogue: result.dialogue,
    });
  } catch (err: any) {
    console.error("[create]", err);
    return NextResponse.json(
      { error: err.message || "Creation pipeline failed" },
      { status: 500 }
    );
  }
}
