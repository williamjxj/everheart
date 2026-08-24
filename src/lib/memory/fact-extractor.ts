/**
 * Extract long-term facts from a conversation turn.
 * Runs asynchronously after a reply is generated.
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
