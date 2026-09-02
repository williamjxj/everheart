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
  /** True while the companion is speaking; used for barge-in. */
  speaking?: boolean;
  /** Stop TTS when the user starts talking over it. */
  onBargeIn?: () => void;
}

const MAX_RECORDING_MS = 3 * 60 * 1000; // hard cap: 3 minutes
const SILENCE_MS = 2500; // auto-stop after 2.5s of silence
const SILENCE_THRESHOLD = 0.015; // RMS below this counts as silence
const MAX_RECONNECT = 2; // Web Speech auto-restart attempts

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "输入消息…",
  lang = "en",
  onLangChange,
  voiceEnabled = true,
  onToggleVoice,
  speaking = false,
  onBargeIn,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxTimerRef = useRef<number | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const manualStopRef = useRef(false);
  const reconnectRef = useRef(0);
  const speakingRef = useRef(speaking);
  const onBargeInRef = useRef(onBargeIn);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  // Stop any capture when the input unmounts.
  useEffect(() => {
    return () => {
      clearTimers();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  function getSpeechRecognition() {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  function canRecord() {
    return (
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== "undefined"
    );
  }

  function clearTimers() {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (silenceRafRef.current !== null) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
  }

  function toggleMic() {
    if (disabled) return;
    if (listening || recording) {
      stopCapture();
      return;
    }
    if (getSpeechRecognition()) {
      startWebSpeech();
    } else if (canRecord()) {
      startRecording();
    } else {
      setMicStatus(
        "当前浏览器不支持语音输入，建议使用 Chrome/Edge，或允许麦克风权限后重试。"
      );
    }
  }

  /** Chrome/Edge fast path: continuous Web Speech with final-only results. */
  function startWebSpeech() {
    const SR = getSpeechRecognition();
    if (!SR) {
      startRecording();
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    sessionRef.current += 1;
    const session = sessionRef.current;
    manualStopRef.current = false;
    reconnectRef.current = 0;

    rec.lang = lang === "zh" ? "zh-CN" : "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (sessionRef.current !== session) return;
      setListening(true);
      setRecording(false);
      setMicStatus(null);
      // Barge-in: the user started talking over the companion's voice.
      if (speakingRef.current) onBargeInRef.current?.();
    };

    rec.onresult = (e: any) => {
      if (sessionRef.current !== session) return;
      let transcript = "";
      for (let i = e.resultIndex; i < (e.results?.length ?? 0); i++) {
        const result = e.results[i];
        if (result?.isFinal) transcript += result[0]?.transcript ?? "";
      }
      if (transcript) {
        setValue((v) => (v ? `${v} ${transcript}` : transcript));
      }
    };

    rec.onend = () => {
      if (sessionRef.current !== session) return;
      clearTimers();
      if (!manualStopRef.current && reconnectRef.current < MAX_RECONNECT) {
        // Chrome can end a session after silence; restart to keep dictation going.
        reconnectRef.current += 1;
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
      recognitionRef.current = null;
    };

    rec.onerror = (e: any) => {
      if (sessionRef.current !== session) return;
      clearTimers();
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setListening(false);
        setMicStatus("未获得麦克风权限：请在浏览器地址栏允许麦克风后重试。");
        return;
      }
      // Network / aborted / no-speech: fall back to recorder once.
      if (!manualStopRef.current && canRecord()) {
        setListening(false);
        startRecording();
        return;
      }
      setListening(false);
    };

    try {
      rec.start();
    } catch {
      if (canRecord()) {
        setListening(false);
        startRecording();
      } else {
        setMicStatus("语音识别启动失败，请重试。");
      }
    }
    // Hard cap so a stuck session can't keep the mic forever.
    maxTimerRef.current = window.setTimeout(() => {
      manualStopRef.current = true;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }, MAX_RECORDING_MS);
  }

  /** Fallback for non-Chrome browsers: record and upload to /api/stt. */
  async function startRecording() {
    if (!canRecord()) {
      setMicStatus("当前浏览器不支持录音，建议使用 Chrome/Edge。");
      return;
    }
    sessionRef.current += 1;
    const session = sessionRef.current;
    manualStopRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (sessionRef.current === session) {
        setMicStatus("未获得麦克风权限：请在浏览器地址栏允许麦克风后重试。");
      }
      return;
    }
    if (sessionRef.current !== session) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => window.MediaRecorder.isTypeSupported(t)
    );
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => handleRecordingDone(session);
    rec.start();

    setRecording(true);
    setListening(false);
    setMicStatus("录音中…（静音 2.5 秒自动结束）");
    startSilenceWatch(stream, session);
    maxTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORDING_MS);
  }

  /** RMS-based silence detector; stops the recorder after 2.5s of quiet. */
  function startSilenceWatch(stream: MediaStream, session: number) {
    try {
      const Ctx =
        window.AudioContext ||
        (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let silentSince = Date.now();

      const tick = () => {
        if (sessionRef.current !== session) {
          ctx.close().catch(() => {});
          return;
        }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms < SILENCE_THRESHOLD) {
          if (Date.now() - silentSince >= SILENCE_MS) {
            stopRecording();
            return;
          }
        } else {
          silentSince = Date.now();
        }
        silenceRafRef.current = requestAnimationFrame(tick);
      };
      silenceRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Analyser unavailable → the 3-minute cap still bounds the recording.
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function handleRecordingDone(session: number) {
    clearTimers();
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    if (sessionRef.current !== session) return;

    setRecording(false);
    const type = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    if (blob.size === 0) {
      setMicStatus("没有录到声音，请重试。");
      return;
    }

    setMicStatus("识别中…");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      fd.append("language", lang === "zh" ? "zh-CN" : "en-US");
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `stt ${res.status}`);
      }
      const data = await res.json();
      const text = String(data.text ?? "").trim();
      if (text) setValue((v) => (v ? `${v} ${text}` : text));
      setMicStatus(null);
    } catch (err: any) {
      setMicStatus(
        String(err?.message || "").includes("未配置")
          ? "服务端语音识别未配置，请使用 Chrome/Edge 的语音输入。"
          : `识别失败：${err?.message || "请重试"}`
      );
    }
  }

  /** User clicked the mic while capturing: discard and reset. */
  function stopCapture() {
    sessionRef.current += 1;
    manualStopRef.current = true;
    clearTimers();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setListening(false);
    setRecording(false);
    setMicStatus(null);
  }

  const iconButton =
    "shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium transition " +
    "border border-zinc-700 hover:border-zinc-500";
  const capturing = listening || recording;
  const micLabel = listening ? "● 聆听中" : recording ? "● 录音中" : "🎤 语音";

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
            capturing
              ? "bg-rose-600 border-rose-600 text-white"
              : "bg-zinc-900 text-zinc-300"
          }`}
          title={capturing ? "停止聆听" : "语音输入"}
        >
          {micLabel}
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
        {micStatus && (
          <span className="text-xs text-zinc-500 truncate">{micStatus}</span>
        )}
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
