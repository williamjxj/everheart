/**
 * Anonymous player identity — the Phase P1 bridge until real accounts land.
 *
 * The app has no auth yet (`/api/companions` still hardcodes `demo-user`), but
 * server-side memory needs *some* stable key or every visitor shares one memory.
 * So the client generates a UUID, keeps it in localStorage, and sends it as
 * `playerId`; the server treats it as the `eh_user.id`.
 *
 * This is not authentication: a playerId is a bearer identifier, so it only
 * grants access to anonymous game data. When Clerk goes in (P2 / production),
 * migrate these rows onto the real user id and stop trusting the header value.
 */

import { prisma } from "@/lib/db/client";
import { sanitizePlayerId } from "@/lib/auth/player-id";

export { sanitizePlayerId };

/**
 * Resolve a playerId to an `eh_user` row, creating it on first use.
 * Throws when the id is malformed so callers can answer 400 rather than write
 * data under a bogus owner.
 */
export async function ensurePlayer(playerId: unknown): Promise<string> {
  const id = sanitizePlayerId(playerId);
  if (!id) throw new Error("invalid playerId");
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: { id, displayName: "Player" },
  });
  return id;
}
