import OpenAI from "openai";

/**
 * Thin DeepSeek client (OpenAI-compatible API).
 * Supports platform key or user BYOK.
 */

export function createDeepSeekClient(apiKey?: string) {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is required (or pass a BYOK key)");
  }

  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });

  // deepseek-v4-pro thinking is on by default and can consume the whole
  // max_tokens budget before any `content` is produced. Disable it so chat
  // streaming and JSON stages get a normal reply.
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = ((
    body: OpenAI.Chat.ChatCompletionCreateParams,
    options?: OpenAI.RequestOptions
  ) =>
    originalCreate(
      {
        ...body,
        thinking: { type: "disabled" },
        // The SDK's union types don't know about DeepSeek's `thinking`
        // param, so we bypass the union check while keeping the shape.
      } as unknown as OpenAI.Chat.ChatCompletionCreateParams,
      options
    )) as typeof client.chat.completions.create;

  return client;
}

function defaultModel() {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
}

/** All tiers use DEEPSEEK_MODEL (default: deepseek-v4-pro). */
export const MODEL_LADDER = {
  get cheap() {
    return defaultModel();
  },
  get roleplay() {
    return defaultModel();
  },
  get general() {
    return defaultModel();
  },
  get premium() {
    return defaultModel();
  },
};

export type ModelTier = keyof typeof MODEL_LADDER;
