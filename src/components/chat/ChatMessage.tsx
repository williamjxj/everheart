"use client";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

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
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-rose-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
