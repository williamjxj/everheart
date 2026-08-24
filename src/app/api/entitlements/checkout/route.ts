/**
 * POST /api/entitlements/checkout
 * Creates a Stripe Checkout Session for a one-time license.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLicenseCheckoutSession, LicenseTier } from "@/lib/payments/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, userId, email } = body as {
      tier: LicenseTier;
      userId: string;
      email?: string;
    };

    if (!tier || !userId) {
      return NextResponse.json({ error: "tier and userId required" }, { status: 400 });
    }

    if (!["starter", "standard", "creator"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createLicenseCheckoutSession({
      tier,
      userId,
      email,
      successUrl: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("[checkout]", err);
    return NextResponse.json(
      { error: err.message || "Checkout creation failed" },
      { status: 500 }
    );
  }
}
