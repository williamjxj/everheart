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
import { CompanionProfile } from "@/components/chat/CompanionProfile";
import { cleanSpeechText, splitStreamBuffer } from "@/lib/speech";
import { CompanionData, DEMO_COMPANIONS } from "@/lib/demo-companions";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}



// Demo seed companions (localStorage fallback when no DB yet)


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

/** Map a companion's static portrait to its 3s Ken Burns clip when available. */
function portraitVideoUrl(portraitUrl?: string | null) {
  return portraitUrl ? portraitUrl.replace(/\.png$/, ".mp4") : undefined;
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
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(true);
  const [inputLang, setInputLang] = useState<"en" | "zh">("en");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showProfile, setShowProfile] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceEnabledRef = useRef(voiceEnabled);
  const inputLangRef = useRef(inputLang);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    inputLangRef.current = inputLang;
  }, [inputLang]);

  const speechQueueRef = useRef<{ text: string }[]>([]);
  const speechBufferRef = useRef("");
  const speechBusyRef = useRef(false);
  const speechSessionRef = useRef(0);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

  /** Speak one sentence and resolve when playback finishes (or fails). */
  const speakSentence = useCallback(
    async (text: string, c: CompanionData, lang: "en" | "zh") => {
      if (!text) return;
      const voice = c.voice?.[lang] || (lang === "zh" ? "zh-CN-XiaoxiaoNeural" : "en-US-AvaNeural");
      const rate = c.voice?.rate || "+0%";
      const localVoice = c.voice?.local?.[lang] || "";
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, rate, localVoice, engine: "auto" }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        audioRef.current?.pause();
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      } catch {
        /* skip this sentence */
      }
    },
    []
  );

  /** Play queued sentences sequentially; highlight the active subtitle. */
  const pumpSpeech = useCallback(
    async (c: CompanionData, lang: "en" | "zh") => {
      if (!voiceEnabledRef.current || speechBusyRef.current) return;
      const next = speechQueueRef.current.shift();
      if (!next) return;
      const session = speechSessionRef.current;
      speechBusyRef.current = true;
      setSpeaking(true);
      setActiveSubtitle(next.text);
      await speakSentence(next.text, c, lang);
      if (session !== speechSessionRef.current) return; // reset happened
      speechBusyRef.current = false;
      if (speechQueueRef.current.length > 0) {
        pumpSpeech(c, lang);
      } else {
        setActiveSubtitle(null);
        setSpeaking(false);
      }
    },
    [speakSentence]
  );

  /** Feed a streamed chunk; complete sentences are spoken immediately. */
  const feedSpeechStream = useCallback(
    (chunk: string, c: CompanionData, lang: "en" | "zh") => {
      if (!voiceEnabledRef.current) return;
      speechBufferRef.current += chunk;
      const { complete, rest } = splitStreamBuffer(speechBufferRef.current);
      speechBufferRef.current = rest;
      if (complete.length > 0) {
        speechQueueRef.current.push(
          ...complete
            .map((text) => ({ text: cleanSpeechText(text) }))
            .filter((item) => item.text.length > 0)
        );
        pumpSpeech(c, lang);
      }
    },
    [pumpSpeech]
  );

  /** Stop any pending speech (new message / user stops generation). */
  const resetSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    speechBufferRef.current = "";
    speechQueueRef.current = [];
    audioRef.current?.pause();
    setActiveSubtitle(null);
    setSpeaking(false);
  }, []);

  // Load companions + current companion + history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Characters come from Supabase (eh_companion); fall back to the local
      // roster when the API is unavailable. Conversations stay in the browser.
      let roster: CompanionData[] = [];
      try {
        const res = await fetch("/api/companions");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.companions) && data.companions.length > 0) {
            roster = data.companions;
          }
        }
      } catch {
        /* offline → local roster */
      }
      if (cancelled) return;

      const list = roster.length > 0 ? roster : loadCompanions();
      setCompanions(list);
      const found = list.find((c) => c.id === companionId) || null;
      setCompanion(found);
      setLoading(false);

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

        // Greet with voice when the conversation is just the opening line.
        if (history.length === 1 && history[0].id === "opening") {
          if (voiceEnabledRef.current) {
            const opening = cleanSpeechText(found.card.first_mes);
            if (opening) {
              speechQueueRef.current.push({ text: opening });
              pumpSpeech(found, inputLangRef.current);
            }
          }
        }

        // Load memory (dynamic data stays in the browser)
        try {
          const mem = localStorage.getItem(`everheart_mem_${companionId}`);
          if (mem) {
            const parsed = JSON.parse(mem);
            setFacts(parsed.facts || []);
            setSummary(parsed.summary || "");
          }
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companionId, pumpSpeech]);

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
      resetSpeech();

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
          feedSpeechStream(chunk, companion, inputLangRef.current);
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

        // Flush any remaining partial sentence into the speech queue.
        const rest = speechBufferRef.current.trim();
        speechBufferRef.current = "";
        if (rest) {
          const cleaned = cleanSpeechText(rest);
          if (cleaned) {
            speechQueueRef.current.push({ text: cleaned });
            pumpSpeech(companion, inputLangRef.current);
          }
        }

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
    [companion, companionId, messages, facts, summary, isStreaming, ageOk, resetSpeech, feedSpeechStream, pumpSpeech]
  );

  function handleStop() {
    abortRef.current?.abort();
    setIsStreaming(false);
    resetSpeech();
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

  // Stop speech when leaving the chat page.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (loading) {
    const known = DEMO_COMPANIONS.find((c) => c.id === companionId);
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-zinc-800 overflow-hidden ring-1 ring-zinc-700">
            {known?.portraitUrl ? (
              <video
                src={portraitVideoUrl(known.portraitUrl)}
                aria-label={known.name}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                {known?.name?.slice(0, 1) ?? "…"}
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <span className="inline-flex gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce" />
              <span
                className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.3s" }}
              />
            </span>
          </div>
          <p className="text-zinc-400">正在进入与 {known?.name ?? "伴侣"} 的聊天…</p>
        </div>
      </div>
    );
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
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium overflow-hidden">
              {companion.portraitUrl ? (
                <video
                  src={portraitVideoUrl(companion.portraitUrl)}
                  aria-label={companion.name}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                companion.name.slice(0, 1)
              )}
            </div>
            <div>
              <h1 className="font-semibold leading-tight">{companion.name}</h1>
              <p className="text-xs text-zinc-500">
                {speaking ? (
                  <span className="text-rose-400">🔊 正在说话…</span>
                ) : isStreaming ? (
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
            {!showProfile && (
              <button
                onClick={() => setShowProfile(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
              >
                ℹ️ 简介
              </button>
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
        <div className="flex-1 overflow-y-auto relative px-4 py-6">
          {/* Living portrait as a soft backdrop */}
          <div className="pointer-events-none absolute inset-0">
            <video
              src={portraitVideoUrl(companion.portraitUrl)}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover opacity-15 blur-md scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/40 to-zinc-950/90" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            {showProfile && (
              <CompanionProfile
                companion={companion}
                onClose={() => setShowProfile(false)}
              />
            )}
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                role={m.role}
                content={m.content}
                activeSubtitle={activeSubtitle}
              />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                role="assistant"
                content={streamingContent}
                isStreaming
                activeSubtitle={activeSubtitle}
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
          lang={inputLang}
          onLangChange={setInputLang}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled((v) => !v)}
        />
      </div>
    </div>
  );
}
