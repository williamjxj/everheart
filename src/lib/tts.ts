/**
 * TTS helpers for Everheart companion voice.
 * Uses Microsoft Edge neural voices via `uvx edge-tts` (see /api/tts).
 * Voices are per-companion (en + zh), borrowing the voice-pool idea from
 * the wenyan2video pipeline.
 */

export const DEFAULT_VOICE = "en-US-AvaNeural";

export const TTS_VOICES = new Set([
  // English
  "en-US-AnaNeural",
  "en-US-AriaNeural",
  "en-US-AvaNeural",
  "en-US-BrianNeural",
  "en-US-ChristopherNeural",
  "en-US-EmmaMultilingualNeural",
  "en-US-EmmaNeural",
  "en-US-EricNeural",
  "en-US-GuyNeural",
  "en-US-JennyNeural",
  "en-US-MichelleNeural",
  "en-US-RogerNeural",
  "en-US-SteffanNeural",
  "en-US-AndrewNeural",
  // Chinese
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-YunjianNeural",
  "zh-CN-YunxiNeural",
  "zh-CN-YunyangNeural",
  "zh-CN-YunxiaNeural",
]);

export const DEFAULT_RATE = "+0%";

/**
 * Strip stage directions / markdown / emoji before speaking so the audio is
 * pure dialogue. Only single-asterisk spans (*...*) are treated as narration
 * and removed — **bold**, quotes, links, and code keep their text.
 */
export function cleanForSpeech(raw: string): string {
  return (raw || "")
    .replace(/\*(?!\*)[^*]*\*(?!\*)/g, " ") // *action / narration* → space (keeps **bold**)
    .replace(/\*\*/g, "") // leftover bold markers (inner text kept)
    .replace(/`([^`]*)`/g, "$1") // inline code → its text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links → label
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*>\s?/gm, "") // blockquote markers
    .replace(/\[[^\]]*\]/g, " ") // [已停止] etc.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ") // emoji
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidRate(rate: string): boolean {
  return /^[+-]?\d+%$/.test(rate);
}

/** Kokoro local voices use a 3-letter prefix per language family. */
export const KOKORO_VOICE_PREFIXES = new Set([
  "af_",
  "am_",
  "bf_",
  "bm_",
  "zf_",
  "zm_",
]);

export function isValidKokoroVoice(voice: string): boolean {
  return KOKORO_VOICE_PREFIXES.has(voice.slice(0, 3));
}
