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
  const re = /[^.!?。！？]+[.!?。！？]+[”"'）)]?/g;
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
