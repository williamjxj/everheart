/**
 * Character card import / export helpers.
 * Supports plain JSON and basic PNG tEXt embedding (SillyTavern style).
 */

import { CharacterCard, CharacterCardSchema } from "@/types/character-card";

/**
 * Export card as clean JSON (downloadable).
 */
export function exportCardJson(card: CharacterCard): string {
  // Strip internal Everheart-only fields if desired, or keep them.
  return JSON.stringify(card, null, 2);
}

/**
 * Validate and parse an incoming card (JSON string or already parsed object).
 */
export function importCardJson(raw: string | object): CharacterCard {
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  return CharacterCardSchema.parse(obj);
}

/**
 * Very basic PNG embedding note:
 * Full tEXt chunk embedding requires a PNG library (e.g. pngjs or sharp + custom chunk).
 * For the MVP we provide JSON download + a note that PNG export can be added later.
 * SillyTavern accepts both JSON and PNG-with-metadata.
 */
export function getExportFilename(card: CharacterCard): string {
  const safe = card.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  return `${safe}_everheart_card.json`;
}
