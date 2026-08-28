"use client";

import ReactMarkdown from "react-markdown";
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
            <Markdown inline>{sentence}</Markdown>
            {i < sentences.length - 1 ? " " : ""}
          </span>
        );
      })
    : <Markdown>{content}</Markdown>;

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

/** Lightweight markdown renderer styled for chat bubbles. */
function Markdown({
  children,
  inline = false,
}: {
  children: string;
  inline?: boolean;
}) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) =>
          inline ? <span>{children}</span> : <p>{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/30 rounded px-1 py-0.5 text-[13px] font-mono">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-400 underline"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[15px] font-semibold mt-2 mb-1">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 my-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 my-1">{children}</ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-600 pl-3 my-1 text-zinc-300">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
