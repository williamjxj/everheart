"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  lang?: "en" | "zh";
  onLangChange?: (lang: "en" | "zh") => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "输入消息…",
  lang = "en",
  onLangChange,
  voiceEnabled = true,
  onToggleVoice,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function toggleMic() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("当前浏览器不支持语音输入，建议使用 Chrome 或 Edge。");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = lang === "zh" ? "zh-CN" : "en-US";
    // Keep listening across pauses so long sentences / dictation don't get
    // cut off after the first utterance.
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < (e.results?.length ?? 0); i++) {
        const result = e.results[i];
        if (result?.isFinal) transcript += result[0]?.transcript ?? "";
      }
      if (transcript) {
        setValue((v) => (v ? `${v} ${transcript}` : transcript));
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const iconButton =
    "shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium transition " +
    "border border-zinc-700 hover:border-zinc-500";

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur"
    >
      <div className="flex items-center gap-2 pb-2">
        <button
          type="button"
          onClick={toggleMic}
          className={`${iconButton} ${
            listening
              ? "bg-rose-600 border-rose-600 text-white"
              : "bg-zinc-900 text-zinc-300"
          }`}
          title={listening ? "停止聆听" : "语音输入"}
        >
          {listening ? "● 聆听中" : "🎤 语音"}
        </button>
        <button
          type="button"
          onClick={() => onLangChange?.(lang === "zh" ? "en" : "zh")}
          className={`${iconButton} bg-zinc-900 text-zinc-300`}
          title="切换语音语言"
        >
          {lang === "zh" ? "中文" : "EN"}
        </button>
        <button
          type="button"
          onClick={() => onToggleVoice?.()}
          className={`${iconButton} bg-zinc-900 text-zinc-300`}
          title={voiceEnabled ? "关闭语音回复" : "开启语音回复"}
        >
          {voiceEnabled ? "🔊" : "🔇"}
        </button>
      </div>
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 max-h-40"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="shrink-0 h-11 px-5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition"
        >
          发送
        </button>
      </div>
    </form>
  );
}
