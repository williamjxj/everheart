/**
 * Sentence splitting shared by streaming TTS and bubble subtitles.
 * Supports English ( . ! ? + closing quotes) and Chinese ( 。！？).
 */
export function splitSentences(
  text: string,
  options: { keepPartial?: boolean } = {}
): string[] {
  const { keepPartial = true } = options;
  const { complete, rest } = splitStreamBuffer(text);
  const parts = [...complete];
  const tail = rest.trim();
  if (tail && keepPartial) parts.push(tail);
  return parts;
}

/**
 * Split a growing stream buffer into complete sentences plus the trailing
 * partial fragment (which is not spoken until it completes).
 */
export function splitStreamBuffer(text: string): {
  complete: string[];
  rest: string;
} {
  // The trailing class includes `*` so an action span like "*He smiles.*"
  // is kept whole — splitting inside it would leave an unbalanced asterisk
  // that cleanSpeechText can't strip.
  const re = /[^.!?。！？]+[.!?。！？]+[”"'）)*]?/g;
  const complete: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sentence = m[0].trim();
    if (sentence) complete.push(sentence);
    last = m.index + m[0].length;
  }
  return { complete, rest: text.slice(last) };
}

/**
 * Strip narration/actions and markdown syntax before speaking a sentence.
 * Roleplay replies use *...* for stage directions (e.g. "*Kai smiles.* Hey.")
 * — those are actions, not voice, so they are removed. **bold**, `code`,
 * [links](url) and # headings are reduced to their spoken form; emoji is kept.
 */
export function cleanSpeechText(text: string): string {
  return text
    .replace(/\*(?!\*)[^*]*\*(?!\*)/g, " ") // *action / italics* → space (keeps **bold**)
    .replace(/\*\*/g, "") // leftover bold markers
    .replace(/`([^`]*)`/g, "$1") // inline code → its text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links → label
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*>\s?/gm, "") // blockquote markers
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split text for TTS so a single request stays under provider limits
 * (the /api/tts route rejects > 2000 chars). Prefers sentence boundaries;
 * over-long sentences are cut at the last word boundary (hard character
 * split for CJK / space-less text).
 */
export function chunkSpeechText(text: string, maxLen = 1600): string[] {
  const limit = Math.max(1, maxLen || 1600);
  const chunks: string[] = [];
  for (const sentence of splitSentences(text)) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= limit) {
      chunks.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(" ", limit);
      if (cut <= 0) cut = limit;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}
