/**
 * LLM-powered fact extraction and conversation summarization.
 * Server-only — depends on the OpenAI SDK / DeepSeek client.
 */

import { createDeepSeekClient, MODEL_LADDER } from "@/lib/llm/deepseek";
import { z } from "zod";

const FactsSchema = z.object({
  facts: z.array(z.string()).max(5),
});

export async function extractFacts(
  userMessage: string,
  assistantReply: string,
  existingFacts: string[] = [],
  userApiKey?: string
): Promise<string[]> {
  const client = createDeepSeekClient(userApiKey);

const system = `You extract durable facts about the user or the relationship from a short chat exchange.
Only extract facts that should be remembered long-term (name, preferences, important events, boundaries, relationships).
Do NOT extract temporary scene details.
Output ONLY valid JSON: { "facts": string[] }
If nothing new and durable, return { "facts": [] }.
Write anything the user asked the companion to stop doing as "Boundary: <rule>" (e.g. "Boundary: don't call the user 哥哥").
Avoid duplicates of existing facts.`;

  const user = `Existing facts:
${existingFacts.map((f) => `- ${f}`).join("\n") || "(none)"}

User: ${userMessage}
Assistant: ${assistantReply}

Extract 0-3 new durable facts.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_LADDER.cheap,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return [];

    const parsed = FactsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.facts;
  } catch {
    return [];
  }
}

const DeltaSchema = z.object({
  facts: z.array(z.string()).max(5).optional(),
  summary: z.string().optional(),
});

export interface MemoryDelta {
  facts: string[];
  /** Present only when the caller asked for a refreshed rolling summary. */
  summary?: string;
}

/**
 * One LLM call that does both jobs for a completed exchange: pull out new
 * durable facts, and (only when asked) refresh the rolling summary.
 *
 * Merging them matters for cost: the two operations read the same messages, so
 * splitting them would double the tokens and the round trips on every fold.
 * Failures degrade to an empty delta — callers already ran the rule-based
 * extractor, so memory still advances offline.
 */
export async function extractMemoryDelta(args: {
  userMessage: string;
  assistantReply: string;
  existingFacts?: string[];
  previousSummary?: string;
  /** Messages covered by the new summary; only read when `includeSummary`. */
  recentMessages?: { role: string; content: string }[];
  includeSummary?: boolean;
  userApiKey?: string;
}): Promise<MemoryDelta> {
  const {
    userMessage,
    assistantReply,
    existingFacts = [],
    previousSummary,
    recentMessages = [],
    includeSummary = false,
    userApiKey,
  } = args;

  let client;
  try {
    client = createDeepSeekClient(userApiKey);
  } catch {
    return { facts: [] };
  }

  const system = `You maintain long-term memory for an AI companion app.
Output ONLY valid JSON with this shape:
{ "facts": string[], "summary": string }

facts: 0-3 durable facts about the user or the relationship worth remembering long-term
  (name, preferences, important events, boundaries, relationships, pets, work, health).
  - Skip temporary scene details.
  - Skip anything already covered by the existing facts.
  - Write anything the user asked the companion to stop doing as "Boundary: <rule>"
    (e.g. "Boundary: don't call the user 哥哥"). These are permanent.
  - Use "" for summary when no summary update was requested.${
    includeSummary
      ? `

summary: rewrite the rolling summary of the whole conversation so far.
  - 120-200 words, third person, same language the user writes in.
  - Keep: relationship progress, preferences and boundaries the user stated, important events.
  - Drop: small talk, repeated pleasantries, anything already implied by the facts.`
      : ""
  }`;

  const transcript = recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")
    .slice(-6000);

  const user = `Existing facts:
${existingFacts.map((f) => `- ${f}`).join("\n") || "(none)"}
${includeSummary ? `\nPrevious summary:\n${previousSummary || "(none)"}\n` : ""}
Latest exchange:
User: ${userMessage}
Assistant: ${assistantReply}
${includeSummary && transcript ? `\nRecent conversation to fold in:\n${transcript}\n` : ""}
Return the JSON object now.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_LADDER.cheap,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: includeSummary ? 700 : 300,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { facts: [] };

    const parsed = DeltaSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { facts: [] };

    const facts = (parsed.data.facts || [])
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 3);
    const summary = includeSummary ? parsed.data.summary?.trim() : undefined;
    return summary ? { facts, summary } : { facts };
  } catch {
    return { facts: [] };
  }
}

/**
 * Produce a rolling summary of recent messages.
 */
export async function summarizeConversation(
  messages: { role: string; content: string }[],
  previousSummary?: string,
  userApiKey?: string
): Promise<string> {
  const client = createDeepSeekClient(userApiKey);

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const system = `You maintain a concise rolling summary of an ongoing roleplay conversation.
Keep important plot points, emotional state, and key facts.
Max 150-200 words. Write in third person.`;

  const user = previousSummary
    ? `Previous summary:\n${previousSummary}\n\nNew messages:\n${transcript}\n\nUpdate the summary.`
    : `Conversation so far:\n${transcript}\n\nWrite a concise summary.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_LADDER.cheap,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    return response.choices[0]?.message?.content?.trim() || previousSummary || "";
  } catch {
    return previousSummary || "";
  }
}
