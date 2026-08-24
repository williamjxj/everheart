/**
 * Context assembler for the chat loop.
 * Combines: character card + rolling summary + recent messages + retrieved facts.
 */

import { CharacterCard } from "@/types/character-card";

export interface AssembledContext {
  systemPrompt: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  tokenEstimate: number;
}

export interface MemoryBundle {
  summary?: string;
  recentMessages: { role: string; content: string }[];
  facts: string[]; // retrieved long-term facts
  authorsNote?: string;
}

/**
 * Build the prompt context for the LLM.
 * Keep under a safe token budget for the chosen model.
 */
export function assembleContext(
  card: CharacterCard,
  memory: MemoryBundle,
  userMessage: string,
  maxRecent = 12
): AssembledContext {
  const systemParts: string[] = [];

  // Core character definition
  systemParts.push(card.system_prompt || `You are ${card.name}.`);
  systemParts.push(`Description:\n${card.description}`);
  systemParts.push(`Personality: ${card.personality}`);
  systemParts.push(`Scenario: ${card.scenario}`);

  if (card.post_history_instructions) {
    systemParts.push(card.post_history_instructions);
  }

  // Long-term memory facts
  if (memory.facts.length > 0) {
    systemParts.push(
      "Known facts about the user / relationship (use them naturally):\n" +
        memory.facts.map((f) => `- ${f}`).join("\n")
    );
  }

  // Rolling summary
  if (memory.summary) {
    systemParts.push(`Conversation summary so far:\n${memory.summary}`);
  }

  if (memory.authorsNote) {
    systemParts.push(`Author's note: ${memory.authorsNote}`);
  }

  // Example dialogue (helps style)
  if (card.mes_example) {
    systemParts.push(`Example dialogue style:\n${card.mes_example}`);
  }

  const systemPrompt = systemParts.join("\n\n");

  // Recent messages (truncate if needed)
  const recent = memory.recentMessages.slice(-maxRecent).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // Current user turn
  recent.push({ role: "user", content: userMessage });

  // Rough token estimate (chars / 4)
  const tokenEstimate = Math.ceil(
    (systemPrompt.length + recent.reduce((acc, m) => acc + m.content.length, 0)) / 4
  );

  return {
    systemPrompt,
    messages: recent,
    tokenEstimate,
  };
}

/**
 * Simple heuristic: should we trigger a new summary?
 */
export function shouldSummarize(messageCount: number, lastSummaryAtCount: number): boolean {
  return messageCount - lastSummaryAtCount >= 20;
}
