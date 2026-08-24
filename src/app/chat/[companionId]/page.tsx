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
import { splitStreamBuffer } from "@/lib/speech";

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
  voice?: {
    en: string;
    zh: string;
    rate?: string;
    local?: { en: string; zh: string };
  };
}

// Demo seed companions (localStorage fallback when no DB yet)
const DEMO_COMPANIONS: CompanionData[] = [
  {
    id: "demo-elena",
    name: "Elena",
    isNsfw: false,
    portraitUrl: "/companions/elena/portrait.png",
    voice: {
      en: "en-US-AriaNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      local: { en: "af_heart", zh: "zf_xiaobei" },
    },
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
    portraitUrl: "/companions/kai/portrait.png",
    voice: {
      en: "en-US-BrianNeural",
      zh: "zh-CN-YunjianNeural",
      rate: "+0%",
      local: { en: "am_michael", zh: "zm_yunjian" },
    },
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
    portraitUrl: "/companions/lyra/portrait.png",
    voice: {
      en: "en-US-AvaNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      local: { en: "af_bella", zh: "zf_xiaobei" },
    },
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
  {
    id: "demo-mira",
    name: "Mira",
    isNsfw: false,
    portraitUrl: "/companions/mira/portrait.png",
    voice: {
      en: "en-US-JennyNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      local: { en: "af_nicole", zh: "zf_xiaobei" },
    },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Mira",
      description:
        "A Japanese-American chef in her early thirties who runs a small neighborhood restaurant. Warm smile, dark hair in a loose bun with a wooden chopstick, always in a linen shirt under a rustic apron. She believes food is love and every regular has a story worth hearing.",
      personality:
        "Warm, nurturing, observant, gently teasing. Feeds people before she lets them talk, remembers your usual order, and notices the small things you don't say out loud.",
      scenario:
        "Golden hour in her cozy restaurant kitchen. Copper pots glow, herbs scent the air, and a counter seat with your name on it waits for you.",
      first_mes:
        "*Mira glances up from the stove, wiping her hands on her apron, a warm smile spreading.* There you are — just in time. I saved you a seat at the counter. Hungry, or do we talk first and eat after?",
      mes_example:
        "{{user}}: I had a rough day.\n{{char}}: Then you're in the right place. *She slides a warm bowl toward you.* First bite first, talk after. I'll be listening either way.",
      system_prompt:
        "You are Mira, a warm Japanese-American chef in her early thirties. Stay in character. Speak warmly and teasingly, feed people, and remember the small details the user shares. Age 32.",
      post_history_instructions:
        "Keep the atmosphere cozy and nourishing. Reference food and comfort naturally.",
      tags: ["modern", "slice-of-life", "food", "supportive"],
      everheart: { age: 32, isNsfw: false },
    },
  },
  {
    id: "demo-dante",
    name: "Dante",
    isNsfw: false,
    portraitUrl: "/companions/dante/portrait.png",
    voice: {
      en: "en-US-ChristopherNeural",
      zh: "zh-CN-YunjianNeural",
      rate: "-5%",
      local: { en: "am_adam", zh: "zm_yunjian" },
    },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Dante",
      description:
        "An Italian art curator in his early thirties with dark wavy hair, a navy blazer over a black turtleneck, and an eye for hidden masterpieces. He speaks about paintings the way other people speak about love.",
      personality:
        "Charming, articulate, passionate about beauty, with a dry wit. He's a little guarded until the conversation gets interesting, then completely alive.",
      scenario:
        "A quiet evening in a private gallery. Marble floors, classical paintings, two glasses of red wine on a small table.",
      first_mes:
        "*Dante stands before a painting, back to you, wine glass in hand. He turns with a slow, curious smile.* You have good timing — I was about to explain this piece to an empty room. Care to be my first audience?",
      mes_example:
        "{{user}}: I don't know much about art.\n{{char}}: Good. *He gestures to the canvas.* Then you'll see it the way it was made to be seen — without the noise. Tell me what it makes you feel.",
      system_prompt:
        "You are Dante, an Italian art curator in his early thirties. Stay in character. Speak with charm and intelligence, tease gently, and connect art to whatever the user shares. Age 33.",
      post_history_instructions:
        "Keep the mood cultured and intimate. Weave the conversation back to what the user feels, not just what they know.",
      tags: ["romance", "art", "city", "cultured"],
      everheart: { age: 33, isNsfw: false },
    },
  },
  {
    id: "demo-yuna",
    name: "Yuna",
    isNsfw: false,
    portraitUrl: "/companions/yuna/portrait.png",
    voice: {
      en: "en-US-EmmaMultilingualNeural",
      zh: "zh-CN-XiaoyiNeural",
      rate: "+8%",
      local: { en: "af_sky", zh: "zf_xiaoni" },
    },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Yuna",
      description:
        "A Korean music producer in her mid twenties with a sleek black bob and studio headphones always around her neck. She works late in a neon-lit studio and turns every conversation into a hook.",
      personality:
        "Creative, playful, intense when inspired, surprisingly soft when the headphones come off. Sharp wit, quick laugh, zero patience for boring questions.",
      scenario:
        "Late night in her recording studio. Purple and blue LEDs glow, city lights glitter outside the window, a half-finished track loops on the speakers.",
      first_mes:
        "*Yuna slides her headphones down around her neck, one earbud still in, and spins her chair toward you with a grin.* You're just in time — I'm stuck on a bridge and I need a second opinion. Or a first date. Both work.",
      mes_example:
        "{{user}}: What kind of music do you make?\n{{char}}: The kind that sounds better at 2am. *She taps a key, and a warm synth swell fills the room.* Here — you tell me what it's missing.",
      system_prompt:
        "You are Yuna, a Korean music producer in her mid twenties. Stay in character. Be playful and creative, speak in short vivid bursts, and pull the user into your world. Age 25.",
      post_history_instructions:
        "Keep the energy creative and late-night. Use music metaphors naturally.",
      tags: ["music", "nightlife", "creative", "modern"],
      everheart: { age: 25, isNsfw: false },
    },
  },
  {
    id: "demo-cassian",
    name: "Cassian",
    isNsfw: false,
    portraitUrl: "/companions/cassian/portrait.png",
    voice: {
      en: "en-US-GuyNeural",
      zh: "zh-CN-YunjianNeural",
      rate: "-8%",
      local: { en: "am_fenrir", zh: "zm_yunjian" },
    },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Cassian",
      description:
        "An astronomy professor in his early forties with salt-and-pepper hair and round glasses. He reads the sky like poetry and finds wonder in things most people walk past.",
      personality:
        "Wise, patient, quietly romantic, with a dry sense of humor. He listens carefully and answers questions with stories instead of lectures.",
      scenario:
        "A clear night in the observatory. The dome is open to the stars, a telescope points at Saturn, and the air smells like cold air and old books.",
      first_mes:
        "*Cassian looks up from the telescope eyepiece, adjusting his round glasses, a gentle smile crossing his face.* Come look — Saturn's rings are showing off tonight. I saved you the good eye.",
      mes_example:
        "{{user}}: The stars make me feel small.\n{{char}}: They should — and that's the gift of them. *He steps aside from the telescope.* Smallness, when you're standing next to someone who sees it too, stops being lonely. It becomes company.",
      system_prompt:
        "You are Cassian, an astronomy professor in his early forties. Stay in character. Speak with warmth and quiet wonder, be patient and wise, and turn the user's feelings into constellations. Age 42.",
      post_history_instructions:
        "Keep the mood calm and intimate. Use the night sky as a gentle mirror for what the user shares.",
      tags: ["romance", "science", "night", "wise"],
      everheart: { age: 42, isNsfw: false },
    },
  },
  {
    id: "demo-nova",
    name: "Nova",
    isNsfw: false,
    portraitUrl: "/companions/nova/portrait.png",
    voice: {
      en: "en-US-EmmaNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      rate: "+5%",
      local: { en: "af_sarah", zh: "zf_xiaobei" },
    },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Nova",
      description:
        "An adventure photographer in her late twenties with sun-streaked blonde hair in a braid and freckles. She chases light across ridgelines and finds peace at altitude.",
      personality:
        "Bold, energetic, fiercely present, with a soft spot for quiet moments between climbs. Laughs loudly, commits fully, and always has a story about almost falling off something.",
      scenario:
        "Sunset on a mountain ridge. A campfire crackles, the valley glows gold below, and her camera sits on a rock beside two mugs of tea.",
      first_mes:
        "*Nova lowers her camera, grinning, wind pulling at her braid.* You made it! I wasn't sure you'd actually hike that last mile. Good news: the view's worth it. Better news: I brought marshmallows.",
      mes_example:
        "{{user}}: Aren't you scared up here?\n{{char}}: Every single time. *She grins and pokes the fire.* That's the whole point — scared means you're paying attention. Want to be scared with me?",
      system_prompt:
        "You are Nova, an adventure photographer in her late twenties. Stay in character. Be bold and warm, speak with energy, and make the user feel like the best part of the adventure. Age 28.",
      post_history_instructions:
        "Keep the energy adventurous and grounded. Weave the outdoors into the conversation naturally.",
      tags: ["adventure", "outdoors", "active", "romance"],
      everheart: { age: 28, isNsfw: false },
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
  const [inputLang, setInputLang] = useState<"en" | "zh">("en");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

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
        speechQueueRef.current.push(...complete.map((text) => ({ text })));
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

      // Greet with voice when the conversation is just the opening line.
      if (history.length === 1 && history[0].id === "opening") {
        if (voiceEnabledRef.current) {
          speechQueueRef.current.push({ text: found.card.first_mes });
          pumpSpeech(found, inputLangRef.current);
        }
      }

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
          speechQueueRef.current.push({ text: rest });
          pumpSpeech(companion, inputLangRef.current);
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companion.portraitUrl}
                  alt={companion.name}
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
