/**
 * Gender-aware companion voices.
 *
 * UI-created characters historically got no `voice` field, so TTS fell back
 * to a female default even for male characters. This module assigns an
 * age-gate-safe voice pool based on the character's gender (edge neural voice
 * + Chinese voice + local Kokoro voice), mirroring how the bundled demo
 * characters are voiced.
 */

import type { CompanionVoice } from "@/lib/cards/md";

export type VoiceGender = "male" | "female" | "nonbinary";

const MALE_VOICES: CompanionVoice[] = [
  { en: "en-US-BrianNeural", zh: "zh-CN-YunjianNeural", rate: "+0%", local: { en: "am_michael", zh: "zm_yunjian" } },
  { en: "en-US-ChristopherNeural", zh: "zh-CN-YunjianNeural", rate: "+0%", local: { en: "am_adam", zh: "zm_yunjian" } },
  { en: "en-US-GuyNeural", zh: "zh-CN-YunjianNeural", rate: "-5%", local: { en: "am_fenrir", zh: "zm_yunjian" } },
];

const FEMALE_VOICES: CompanionVoice[] = [
  { en: "en-US-AvaNeural", zh: "zh-CN-XiaoxiaoNeural", rate: "+0%", local: { en: "af_heart", zh: "zf_xiaobei" } },
  { en: "en-US-JennyNeural", zh: "zh-CN-XiaoxiaoNeural", rate: "+0%", local: { en: "af_nicole", zh: "zf_xiaobei" } },
  { en: "en-US-AriaNeural", zh: "zh-CN-XiaoxiaoNeural", rate: "+0%", local: { en: "af_bella", zh: "zf_xiaobei" } },
  { en: "en-US-EmmaNeural", zh: "zh-CN-XiaoyiNeural", rate: "+5%", local: { en: "af_sarah", zh: "zf_xiaobei" } },
];

export function normalizeGender(raw: unknown): VoiceGender | undefined {
  const value = String(raw ?? "").trim().toLowerCase();
  if (/^(male|man|m|boy|guy)$/.test(value)) return "male";
  if (/^(female|woman|f|girl|lady)$/.test(value)) return "female";
  if (/^(nonbinary|non-binary|nb|enby|they)$/.test(value)) return "nonbinary";
  return undefined;
}

/** Best-effort gender from prose (pronouns + nouns). Female is the fallback. */
export function inferGender(
  text: string | null | undefined,
  fallback: VoiceGender = "female"
): VoiceGender {
  const t = String(text ?? "");
  const maleHits =
    (t.match(/\b(he|him|his|man|boy|male)\b/gi) || []).length;
  const femaleHits =
    (t.match(/\b(she|her|hers|woman|girl|female)\b/gi) || []).length;
  if (maleHits > femaleHits) return "male";
  if (femaleHits > maleHits) return "female";
  return fallback;
}

function hashString(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Deterministic voice pick per character so it stays stable across loads. */
export function voiceForCharacter(
  name: string,
  gender: VoiceGender | string | undefined
): CompanionVoice {
  const g = normalizeGender(gender) ?? inferGender(name);
  const pool = g === "male" ? MALE_VOICES : FEMALE_VOICES;
  return pool[hashString(name || "companion") % pool.length];
}

export function genderNoun(gender: VoiceGender | string | undefined): string {
  switch (normalizeGender(gender)) {
    case "male":
      return "man";
    case "female":
      return "woman";
    default:
      return "person";
  }
}
