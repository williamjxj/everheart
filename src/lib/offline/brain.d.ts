/**
 * Type declarations for the offline rule-based chat engine (ported from the
 * original Codex demo). The engine runs without any API key and keeps the
 * app fully interactive when DeepSeek is unavailable.
 */

export interface OfflineCompanion {
  id?: string;
  name?: string;
  gender?: string;
  pronoun?: string;
  personality?: string[];
  interests?: string[];
  catchphrase?: string;
  backstory?: string;
  _msgCount?: number;
}

export interface OfflineChatResult {
  reply: string;
  intent: string;
  facts: string[];
  usedFallback: boolean;
}

export function respond(
  companion: OfflineCompanion,
  history: { role?: string; content?: string; text?: string }[],
  userMessage: string,
  facts?: string[]
): OfflineChatResult;
