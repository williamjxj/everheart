/**
 * Chat Orchestration Loop
 * Router → Context → Generate (stream) → Safety → Memory write (async)
 */

import { createDeepSeekClient, MODEL_LADDER, ModelTier } from "./deepseek";
import { assembleContext, MemoryBundle } from "@/lib/memory/context-assembler";
import { CharacterCard } from "@/types/character-card";
import { extractFacts, summarizeConversation } from "@/lib/memory/fact-extractor";
import { respond, OfflineCompanion } from "@/lib/offline/brain";

export interface ChatRequest {
  card: CharacterCard;
  memory: MemoryBundle;
  userMessage: string;
  userApiKey?: string; // BYOK
  modelTier?: ModelTier;
  isAdultVerified?: boolean;
}

export interface ChatResult {
  reply: string;
  modelUsed: string;
  newFacts: string[];
  shouldUpdateSummary: boolean;
}

/**
 * Builds a companion-shaped object for the offline brain from a full
 * SillyTavern card. The brain only needs a few loose fields; every lookup has
 * a fallback so no card shape can crash it.
 */
function toOfflineCompanion(card: CharacterCard): OfflineCompanion {
  const rawPersonality = card.personality || card.description || "";
  const traits = rawPersonality
    .split(/[.,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: card.name.toLowerCase().replace(/\s+/g, "-"),
    name: card.name,
    personality: traits.length ? traits : ["yourself"],
    interests: card.tags?.length ? card.tags : ["quiet evenings"],
    catchphrase: "",
    backstory: card.description || card.scenario || "",
    _msgCount: 0,
  };
}

function tryCreateClient(userApiKey?: string) {
  try {
    return createDeepSeekClient(userApiKey);
  } catch {
    return null;
  }
}

function offlineReply(
  card: CharacterCard,
  memory: MemoryBundle,
  userMessage: string
): ChatResult {
  const result = respond(
    toOfflineCompanion(card),
    memory.recentMessages || [],
    userMessage,
    memory.facts
  );
  return {
    reply: result.reply,
    modelUsed: "offline-brain",
    newFacts: result.facts,
    shouldUpdateSummary: false,
  };
}

/**
 * Very lightweight safety gate for the MVP.
 * In production replace with a proper classifier + policy engine.
 */
function safetyGate(
  text: string,
  isAdultVerified: boolean
): { allowed: boolean; reason?: string } {
  const lower = text.toLowerCase();

  // Hard block: any indication of minors in sexual context
  const minorPatterns = [
    /\b(child|kid|minor|underage|teen\b.*\b(sex|nude|porn))/i,
    /\b(11|12|13|14|15|16|17)\s*(year|yr)/i,
  ];
  for (const p of minorPatterns) {
    if (p.test(lower)) {
      return { allowed: false, reason: "Content involving minors is prohibited." };
    }
  }

  // Real-person deepfake-ish prompts can be expanded later
  // For MVP we only hard-block the worst cases.

  if (!isAdultVerified) {
    // Soft filter for non-verified users – can be tightened
    const explicit = /\b(sex|nude|porn|fuck|cock|pussy)\b/i;
    if (explicit.test(lower)) {
      return {
        allowed: false,
        reason: "Adult content requires verified 18+ status.",
      };
    }
  }

  return { allowed: true };
}

export async function generateReply(req: ChatRequest): Promise<ChatResult> {
  const {
    card,
    memory,
    userMessage,
    userApiKey,
    modelTier = "roleplay",
    isAdultVerified = false,
  } = req;

  // Safety on user input
  const inputCheck = safetyGate(userMessage, isAdultVerified);
  if (!inputCheck.allowed) {
    return {
      reply: `[System] ${inputCheck.reason}`,
      modelUsed: "none",
      newFacts: [],
      shouldUpdateSummary: false,
    };
  }

  const client = tryCreateClient(userApiKey);
  if (!client) {
    return offlineReply(card, memory, userMessage);
  }
  const ctx = assembleContext(card, memory, userMessage);

  const model = MODEL_LADDER[modelTier] || MODEL_LADDER.roleplay;

  let reply: string;
  try {
    const messages = [
      { role: "system" as const, content: ctx.systemPrompt },
      ...ctx.messages,
    ];

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.9,
      max_tokens: 800,
      stream: false, // for simplicity in this helper; use stream in the API route
    });

    reply = response.choices[0]?.message?.content?.trim() || "...";
  } catch {
    return offlineReply(card, memory, userMessage);
  }

  // Safety on output
  const outputCheck = safetyGate(reply, isAdultVerified);
  if (!outputCheck.allowed) {
    return {
      reply: `[System] The response was blocked for safety reasons.`,
      modelUsed: model,
      newFacts: [],
      shouldUpdateSummary: false,
    };
  }

  // Async-friendly fact extraction (caller can fire-and-forget)
  const newFacts = await extractFacts(
    userMessage,
    reply,
    memory.facts,
    userApiKey
  );

  return {
    reply,
    modelUsed: model,
    newFacts,
    shouldUpdateSummary: true, // caller decides based on count
  };
}

/**
 * Streaming variant for the API route (returns an async iterable of tokens).
 * Simplified – production would use the AI SDK stream helpers.
 */
export async function* streamReply(req: ChatRequest): AsyncGenerator<string> {
  const {
    card,
    memory,
    userMessage,
    userApiKey,
    modelTier = "roleplay",
    isAdultVerified = false,
  } = req;

  const inputCheck = safetyGate(userMessage, isAdultVerified);
  if (!inputCheck.allowed) {
    yield `[System] ${inputCheck.reason}`;
    return;
  }

  const client = tryCreateClient(userApiKey);
  if (!client) {
    yield offlineReply(card, memory, userMessage).reply;
    return;
  }
  const ctx = assembleContext(card, memory, userMessage);
  const model = MODEL_LADDER[modelTier] || MODEL_LADDER.roleplay;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ctx.systemPrompt },
        ...ctx.messages,
      ],
      temperature: 0.9,
      max_tokens: 800,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch {
    yield offlineReply(card, memory, userMessage).reply;
  }
}
