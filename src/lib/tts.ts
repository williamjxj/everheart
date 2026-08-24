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
 * pure dialogue. When quoted speech is present ("..." action "..."), prefer
 * the quoted parts and drop the narration.
 */
export function cleanForSpeech(raw: string): string {
  let text = (raw || "").replace(/\*+[^*]*\*+/g, " ");

  const quotes = text.match(/“[^”"]*”|"[^"]*"/g);
  if (quotes && quotes.length > 0) {
    text = quotes
      .map((q) => q.replace(/^[“"]|[”"]$/g, ""))
      .join(" ");
  }

  text = text
    .replace(/\[[^\]]*\]/g, " ") // [已停止] etc.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ") // emoji
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export function isValidRate(rate: string): boolean {
  return /^[+-]?\d+%$/.test(rate);
}
