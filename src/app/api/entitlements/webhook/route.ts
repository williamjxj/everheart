/**
 * POST /api/entitlements/webhook
 * Stripe webhook – activates license + tops up credits.
 */

import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, LICENSE_TIERS } from "@/lib/payments/stripe";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err: any) {
    console.error("Webhook signature verification failed", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as keyof typeof LICENSE_TIERS;

    if (!userId || !tier || !LICENSE_TIERS[tier]) {
      console.error("Missing metadata on session", session.id);
      return NextResponse.json({ received: true });
    }

    const tierConfig = LICENSE_TIERS[tier];

    try {
      // Activate entitlement
      await prisma.entitlement.create({
        data: {
          userId,
          tier,
          source: "stripe",
          stripeSession: session.id,
          features: tierConfig.features,
        },
      });

      // Top up credits
      await prisma.ledgerEntry.create({
        data: {
          userId,
          type: "license_bonus",
          amountTokens: tierConfig.credits,
          description: `${tierConfig.name} license activation`,
          referenceId: session.id,
        },
      });

      console.log(`Activated ${tier} for user ${userId}`);
    } catch (dbErr) {
      console.error("DB error on webhook", dbErr);
      // Still return 200 so Stripe does not retry forever; alert yourself
    }
  }

  return NextResponse.json({ received: true });
}
