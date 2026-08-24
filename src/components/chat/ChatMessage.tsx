"use client";

import { splitSentences } from "@/lib/speech";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  activeSubtitle?: string | null;
}

export function ChatMessage({
  role,
  content,
  isStreaming,
  activeSubtitle,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const showSubtitle = !isUser && !isSystem && !!activeSubtitle;
  const active = activeSubtitle?.trim() || "";
  let highlighted = false;

  const sentences = splitSentences(content);
  const body = showSubtitle
    ? sentences.map((sentence, i) => {
        const trimmed = sentence.trim();
        const isActive =
          !highlighted && (trimmed === active || trimmed.includes(active) || active.includes(trimmed));
        if (isActive) highlighted = true;
        return (
          <span
            key={i}
            className={
              isActive
                ? "bg-rose-500/25 text-rose-100 rounded px-0.5"
                : undefined
            }
          >
            {sentence}
            {i < sentences.length - 1 ? " " : ""}
          </span>
        );
      })
    : content;

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-rose-600 text-white rounded-br-md"
            : isSystem
            ? "bg-zinc-800 text-zinc-400 border border-zinc-700 text-sm"
            : "bg-zinc-800 text-zinc-100 rounded-bl-md"
        }`}
      >
        {body}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-rose-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
