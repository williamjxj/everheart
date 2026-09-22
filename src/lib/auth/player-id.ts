/**
 * Anonymous player id (Phase P1 bridge; see lib/auth/player.ts for the server
 * half). Generated once per browser and sent with every memory / history
 * request so server-side storage can tell players apart.
 *
 * Kept free of server imports so both the client bundle and the unit tests can
 * use it without dragging Prisma in.
 *
 * Swap this for the real account id when auth lands — the server already treats
 * `playerId` as a plain `eh_user.id`.
 */

const PLAYER_KEY = "everheart_player";

/** UUIDs and cuid-ish ids only; keeps junk and SQL-ish input out. */
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function sanitizePlayerId(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return PLAYER_ID_RE.test(value) ? value : null;
}

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(PLAYER_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PLAYER_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
