/**
 * GET  /api/companions -> { companions: [...] } (persisted characters only)
 * POST /api/companions -> upsert a companion { id?, name, card, isNsfw?, portraitUrl? }
 *
 * Characters (roster) live in Supabase `eh_companion`. Dynamic conversation
 * data (messages / memory) intentionally stays in the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const DEMO_USER_ID = "demo-user";

async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      displayName: "Demo",
      email: "demo@everheart.local",
    },
  });
}

export async function GET() {
  try {
    const rows = await prisma.companion.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      companions: rows.map((c) => ({
        id: c.id,
        name: c.name,
        isNsfw: c.isNsfw,
        portraitUrl: c.portraitUrl,
        card: c.cardJson,
      })),
    });
  } catch (err: any) {
    console.error("[companions:get]", err?.message || err);
    return NextResponse.json(
      { error: "failed to load companions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const card = body.card;
    if (!card || !card.name) {
      return NextResponse.json(
        { error: "card with name required" },
        { status: 400 }
      );
    }
    const user = await ensureDemoUser();
    const id = String(body.id || `c-${Date.now().toString(36)}`);
    const data = {
      name: card.name,
      cardJson: card,
      portraitUrl: body.portraitUrl ?? null,
      isNsfw: !!body.isNsfw,
    };
    const companion = await prisma.companion.upsert({
      where: { id },
      update: data,
      create: { id, userId: user.id, ...data },
    });
    return NextResponse.json({ id: companion.id });
  } catch (err: any) {
    console.error("[companions:post]", err?.message || err);
    return NextResponse.json(
      { error: "failed to save companion" },
      { status: 500 }
    );
  }
}
