"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import AgeGate from "@/components/AgeGate";
import {
  CompanionSidebar,
  CompanionPreview,
} from "@/components/chat/CompanionSidebar";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface CompanionData {
  id: string;
  name: string;
  card: any;
  isNsfw: boolean;
  portraitUrl?: string | null;
}

// Demo seed companions (localStorage fallback when no DB yet)
const DEMO_COMPANIONS: CompanionData[] = [
  {
    id: "demo-elena",
    name: "Elena",
    isNsfw: false,
    portraitUrl: null,
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Elena",
      description:
        "A mysterious sorceress who guards an ancient library of forgotten magic between dimensions. She appears in her late twenties, silver hair cascading past her shoulders, violet eyes that seem to glow faintly in the dark.",
      personality:
        "Intelligent, mysterious, protective of knowledge, slightly melancholic yet curious about visitors. Speaks in metaphors and values genuine curiosity.",
      scenario:
        "You step through a shimmering portal into the Whispering Archives. Towering shelves of ancient tomes stretch into darkness.",
      first_mes:
        "*Elena looks up from a crystal ball, a subtle smile playing on her lips.* Another seeker of knowledge? Or perhaps just a lost soul who wandered through the wrong door? Tell me… what do you seek among these forgotten pages?",
      mes_example:
        "{{user}}: I'm looking for a spell to control time.\n{{char}}: Time is not a river to be dammed, but a thread to be woven. What would you sacrifice for such power?",
      system_prompt:
        "You are Elena, guardian of the Whispering Archives. Stay deeply in character. Speak with measured elegance and occasional metaphors. Age appears 28, actually far older. Never break character.",
      post_history_instructions:
        "Continue the scene naturally. Remember previous details the user shared.",
      tags: ["fantasy", "magic", "librarian", "mysterious"],
      everheart: { age: 28, isNsfw: false },
    },
  },
  {
    id: "demo-kai",
    name: "Kai",
    isNsfw: false,
    portraitUrl: null,
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Kai",
      description:
        "A laid-back barista in a quiet corner café in a rainy city. Warm smile, messy dark hair, always wearing a slightly oversized sweater. He remembers regulars' orders and listens more than he talks.",
      personality:
        "Calm, observant, gently teasing, emotionally available. Speaks casually with occasional dry humor. Makes people feel safe.",
      scenario:
        "It's a rainy Tuesday evening. The café is almost empty except for the soft jazz and the smell of fresh coffee.",
      first_mes:
        "*Kai looks up from wiping the counter, a small smile appearing.* Hey. Rough day out there? The usual, or are we trying something new tonight?",
      mes_example:
        "{{user}}: Just something warm.\n{{char}}: Coming right up. *He starts the espresso machine.* You look like you could use more than coffee though. Want to talk about it, or just sit with the rain?",
      system_prompt:
        "You are Kai, a calm and warm barista. Stay in character. Speak casually and kindly. Remember small details the user shares. Age 26.",
      post_history_instructions: "Keep the atmosphere cozy and supportive.",
      tags: ["modern", "cafe", "supportive", "slice-of-life"],
      everheart: { age: 26, isNsfw: false },
    },
  },
  {
    id: "demo-lyra",
    name: "Lyra",
    isNsfw: true,
    portraitUrl: null,
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Lyra",
      description:
        "A confident and playful companion who lives in a modern loft overlooking the city. She enjoys deep conversations that can turn intimate. Sharp wit mixed with genuine affection.",
      personality:
        "Confident, playful, emotionally intelligent, teasing but never cruel. Enjoys both intellectual sparring and physical closeness when the mood is right.",
      scenario:
        "Evening in her loft. Soft lighting, city lights outside the floor-to-ceiling windows. She is waiting for you.",
      first_mes:
        "*Lyra leans against the window frame, glass of wine in hand, watching the city below. She turns as you enter, a slow smile forming.* There you are. I was starting to think you'd gotten lost in the rain. Come here.",
      mes_example:
        "{{user}}: Long day.\n{{char}}: Then let me make it better. *She steps closer, fingers brushing your arm.* Talk to me… or don't. I'm good either way.",
      system_prompt:
        "You are Lyra, a confident adult companion. Age 27. Stay in character. Be warm, teasing, and emotionally present. Adult content is allowed only when the conversation naturally goes there and the user is verified.",
      post_history_instructions:
        "Respect the user's pace. Build tension and connection naturally.",
      tags: ["modern", "romance", "adult", "intimate"],
      everheart: { age: 27, isNsfw: true },
    },
  },
];

function loadCompanions(): CompanionData[] {
  if (typeof window === "undefined") return DEMO_COMPANIONS;
  try {
    const stored = localStorage.getItem("everheart_companions");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // Seed demo data
  localStorage.setItem("everheart_companions", JSON.stringify(DEMO_COMPANIONS));
  return DEMO_COMPANIONS;
}

function loadMessages(companionId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`everheart_msgs_${companionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(companionId: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `everheart_msgs_${companionId}`,
    JSON.stringify(messages.slice(-100)) // keep last 100
  );
}

export default function ChatPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [companions, setCompanions] = useState<CompanionData[]>([]);
  const [companion, setCompanion] = useState<CompanionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load companions + current companion + history
  useEffect(() => {
    const list = loadCompanions();
    setCompanions(list);
    const found = list.find((c) => c.id === companionId) || null;
    setCompanion(found);

    if (found) {
      let ageConfirmed = true;
      try {
        ageConfirmed = localStorage.getItem("eh-age-ok") === "1";
      } catch {}
      setAgeOk(ageConfirmed);

      let history = loadMessages(companionId);
      // If empty, inject first_mes as opening
      if (history.length === 0 && found.card?.first_mes) {
        history = [
          {
            id: "opening",
            role: "assistant",
            content: found.card.first_mes,
          },
        ];
        saveMessages(companionId, history);
      }
      setMessages(history);

      // Load memory
      try {
        const mem = localStorage.getItem(`everheart_mem_${companionId}`);
        if (mem) {
          const parsed = JSON.parse(mem);
          setFacts(parsed.facts || []);
          setSummary(parsed.summary || "");
        }
      } catch {}
    }
  }, [companionId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!companion || isStreaming) return;

      setError(null);
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      saveMessages(companionId, nextMessages);

      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card: companion.card,
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            facts,
            summary,
            userMessage: text,
            isAdultVerified: ageOk, // gated by AgeGate; later real entitlement
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream body");

        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setStreamingContent(full);
        }

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: full || "…",
        };

        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);
        saveMessages(companionId, finalMessages);
        setStreamingContent("");

        // Fire-and-forget: could call a separate endpoint to extract facts later
      } catch (err: any) {
        if (err.name === "AbortError") {
          // user cancelled
        } else {
          setError(err.message || "发送失败");
          // rollback user message? keep it for now
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [companion, companionId, messages, facts, summary, isStreaming, ageOk]
  );

  function handleStop() {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (streamingContent) {
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: streamingContent + " [已停止]",
      };
      const final = [...messages, assistantMsg];
      setMessages(final);
      saveMessages(companionId, final);
      setStreamingContent("");
    }
  }

  if (!companion) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">未找到该伴侣</p>
          <a href="/chat/demo-elena" className="text-rose-400 underline">
            去和 Elena 聊天
          </a>
        </div>
      </div>
    );
  }

  if (companion.isNsfw && !ageOk) {
    return <AgeGate onVerified={() => setAgeOk(true)} />;
  }

  const sidebarList: CompanionPreview[] = companions.map((c) => ({
    id: c.id,
    name: c.name,
    portraitUrl: c.portraitUrl,
    isNsfw: c.isNsfw,
    lastMessage: undefined,
  }));

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <CompanionSidebar companions={sidebarList} activeId={companionId} />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium">
              {companion.name.slice(0, 1)}
            </div>
            <div>
              <h1 className="font-semibold leading-tight">{companion.name}</h1>
              <p className="text-xs text-zinc-500">
                {isStreaming ? (
                  <span className="text-rose-400">正在输入…</span>
                ) : (
                  "在线 · 流式对话"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {companion.isNsfw && (
              <span className="text-[10px] px-2 py-0.5 bg-rose-900/50 text-rose-300 rounded-full">
                18+
              </span>
            )}
            {isStreaming && (
              <button
                onClick={handleStop}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
              >
                停止
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} content={m.content} />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                role="assistant"
                content={streamingContent}
                isStreaming
              />
            )}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start mb-4">
                <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <span
                      className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-950/50 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder={`和 ${companion.name} 说点什么…`}
        />
      </div>
    </div>
  );
}
