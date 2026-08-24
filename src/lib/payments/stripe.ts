/**
 * Stripe one-time purchase helpers for Everheart licenses.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export const LICENSE_TIERS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER || "price_starter_placeholder",
    amount: 2900, // cents
    credits: 50_000,
    features: ["basic_chat", "create_companions", "export_cards"],
  },
  standard: {
    name: "Standard",
    priceId: process.env.STRIPE_PRICE_STANDARD || "price_standard_placeholder",
    amount: 4900,
    credits: 200_000,
    features: ["basic_chat", "create_companions", "export_cards", "nsfw_unlock", "priority_models"],
  },
  creator: {
    name: "Creator",
    priceId: process.env.STRIPE_PRICE_CREATOR || "price_creator_placeholder",
    amount: 7900,
    credits: 500_000,
    features: [
      "basic_chat",
      "create_companions",
      "export_cards",
      "nsfw_unlock",
      "priority_models",
      "marketplace_list",
    ],
  },
} as const;

export type LicenseTier = keyof typeof LICENSE_TIERS;

/**
 * Create a Stripe Checkout Session for a one-time license purchase.
 */
export async function createLicenseCheckoutSession(opts: {
  tier: LicenseTier;
  userId: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const tierConfig = LICENSE_TIERS[opts.tier];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Everheart ${tierConfig.name} License`,
            description: "One-time purchase · Lifetime access · Includes starting credits",
          },
          unit_amount: tierConfig.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: opts.userId,
      tier: opts.tier,
      type: "license",
    },
    customer_email: opts.email,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  return session;
}

/**
 * Verify and parse a webhook event.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export { stripe };
