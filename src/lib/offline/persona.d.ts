/**
 * Type declarations for the offline persona generator (ported from the
 * original Codex demo). Deterministic per (name, archetype, vibe) — used as a
 * zero-cost fallback when the LLM creation pipeline is unavailable.
 */

export interface OfflinePersona {
  id: string;
  name: string;
  archetype: string;
  vibe: string;
  gender: string;
  pronoun: string;
  age: number;
  personality: string[];
  speechStyle: string;
  catchphrase: string;
  backstory: string;
  openingLine: string;
  interests: string[];
  avatarGradient: string;
  nsfw: boolean;
  price: number | null;
  tagline: string;
}

export const GRADIENTS: string[];

export function generatePersona(input: {
  archetype?: string;
  vibe?: string;
  name?: string;
}): OfflinePersona;
