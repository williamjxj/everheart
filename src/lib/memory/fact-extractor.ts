/**
 * Extract long-term facts from a conversation turn.
 *
 * This module contains only the offline / rule-based extractors.
 * LLM-powered versions live in `fact-extractor-llm.ts` (server-only).
 */

/* ------------------------------------------------------------------ */
/* Rule-based extractors — run client-side so memory works fully offline */
/* ------------------------------------------------------------------ */

const FACT_RULES: { re: RegExp; make: (m: RegExpMatchArray) => string }[] = [
  { re: /\bmy name is ([a-z]+(?:[-'.][a-z]+){0,2})/i, make: (m) => `User's name is ${cap(m[1])}` },
  { re: /\b(?:call me|people call me|friends call me) ([a-z]+(?:[-'.][a-z]+){0,2})/i, make: (m) => `User goes by ${cap(m[1])}` },
  { re: /\bmy birthday is ([^.,!?；;]{3,40})/i, make: (m) => `User's birthday is ${m[1].trim()}` },
  { re: /\b(?:i'?m|i am) ([0-9]{1,2}) (?:years? old|yo)\b/i, make: (m) => `User is ${m[1]} years old` },
  { re: /\bi'?m from ([^.,!?；;]{2,40})/i, make: (m) => `User is from ${m[1].trim()}` },
  { re: /\b(?:i|we) (?:really )?(?:like|love|enjoy|prefer|adore) ([^.,!?；;]{2,60})/i, make: (m) => `User likes ${m[1].trim()}` },
  { re: /\b(?:i|we) (?:really )?(?:hate|dislike|can'?t stand|don'?t like) ([^.,!?；;]{2,60})/i, make: (m) => `User dislikes ${m[1].trim()}` },
  { re: /\bi work (?:as|at) ([^.,!?；;]{2,50})/i, make: (m) => `User works as ${m[1].trim()}` },
  { re: /\bmy job is ([^.,!?；;]{2,50})/i, make: (m) => `User's job: ${m[1].trim()}` },
  { re: /\bi study (?:at|in) ([^.,!?；;]{2,50})/i, make: (m) => `User studies at ${m[1].trim()}` },
  { re: /\bmy (?:dog|cat|pet)(?:'s name| is called| is named)? ([a-z]+(?:[-'.][a-z]+){0,1})/i, make: (m) => `User has a pet named ${cap(m[1])}` },
  { re: /\bremember that ([^.,!?；;]{5,120})/i, make: (m) => m[1].trim() },
  { re: /\bplease (?:don'?t|never) ([^.,!?；;]{3,80})/i, make: (m) => `Boundary: don't ${m[1].trim()}` },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Turns that cannot carry anything worth remembering ("ok", "哈哈", "在吗").
 * Used to skip the paid LLM extraction pass on pure filler — deliberately a
 * short explicit list rather than a length heuristic, because short Chinese
 * messages ("我叫小明") are often the most fact-dense ones.
 */
const FILLER_TURN =
  /^(?:ok(?:ay)?|k|thanks|thank you|thx|ty|hi|hey|hello|yo|lol|lmao|haha+|yes|yeah|nope|no|sure|cool|nice|bye|good night|gn|嗯+|哦+|啊+|好(?:的|吧)?|谢谢|哈哈+|呵呵|在吗|嗨|你好|收到|行|可以|是的|不要|继续)[\s!！。.~～?？,，]*$/i;

export function isFillerTurn(message: string): boolean {
  return FILLER_TURN.test(String(message || "").trim());
}

/** Durable-fact extraction without an LLM (offline path). */
export function extractFactsRuleBased(userMessage: string): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();
  for (const rule of FACT_RULES) {
    const m = rule.re.exec(userMessage);
    if (!m) continue;
    const fact = rule.make(m).trim();
    const key = fact.toLowerCase();
    if (fact && !seen.has(key)) {
      seen.add(key);
      facts.push(fact);
    }
    if (facts.length >= 4) break;
  }
  return facts;
}

const ENTITY_RE = /\bmy (dog|cat|pet|brother|sister|mom|mother|dad|father|boss|friend|best friend|partner|boyfriend|girlfriend|wife|husband|son|daughter|roommate|neighbor)(?:'s name| is called| is named|,)? ([a-z]+(?:[ .'-][a-z]+){0,1})(?=\s+(?:is|and|,|\.)|$)/i;

/** Named entities mentioned by the user (offline path). */
export function extractEntitiesRuleBased(
  userMessage: string
): { name: string; note: string }[] {
  const m = ENTITY_RE.exec(userMessage);
  if (!m) return [];
  return [{ name: cap(m[2].trim()), note: `User's ${m[1].toLowerCase()}` }];
}

/** Compact a block of exchanges into an episodic summary (offline path). */
export function condenseEpisodeLocal(
  exchanges: { role: string; content: string }[]
): { summary: string; keywords: string[] } {
  const userLines = exchanges
    .filter((e) => e.role === "user")
    .map((e) => e.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const assistantLines = exchanges
    .filter((e) => e.role === "assistant")
    .map((e) => e.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const first = userLines[0]?.slice(0, 140) || "";
  const lastReply = assistantLines[assistantLines.length - 1]?.slice(0, 100) || "";
  const summary = first
    ? `About: ${first}${lastReply ? ` … ended: ${lastReply}` : ""}`
    : lastReply || "A quiet moment";

  const freq = new Map<string, number>();
  for (const line of [...userLines, ...assistantLines]) {
    for (const w of line.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean)) {
      if (w.length < 3 || ["the", "and", "that", "you", "your", "have", "with"].includes(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  return { summary: summary.slice(0, 400), keywords };
}
