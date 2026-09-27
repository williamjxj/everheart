# Everheart Audio / Voice Implementation Summary

This document summarizes how voice input (STT) and voice output (TTS) are implemented in the current app.

## Scope and key files

- **Chat UI + runtime orchestration**
  - `src/app/chat/[companionId]/page.tsx`
  - `src/components/chat/ChatInput.tsx`
- **TTS API + helpers**
  - `src/app/api/tts/route.ts`
  - `src/lib/tts.ts`
  - `src/lib/speech.ts`
  - `src/lib/tts/gender-voice.ts`
- **STT API**
  - `src/app/api/stt/route.ts`
- **Local TTS server script**
  - `scripts/tts_local_server.py`

## 1) Voice input (STT)

### Browser-side capture strategy (`ChatInput.tsx`)

1. User taps the mic button.
2. The client first tries **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) for low-latency dictation.
3. If unavailable or failed, it falls back to **MediaRecorder**.
4. MediaRecorder path auto-stops after:
   - 2.5s silence (RMS-based detector), or
   - 3-minute hard timeout.
5. Recorded audio is uploaded to `POST /api/stt` as `multipart/form-data`.

### Server-side transcription (`/api/stt`)

- Requires `OPENAI_API_KEY`; if missing, returns `503` so the client can rely on browser Web Speech.
- Audio can be normalized with `ffmpeg` to 16kHz mono WAV (best effort).
- Main model: `gpt-4o-transcribe` (`STT_MODEL` can override).
- Fallback model: `whisper-1`.
- Returns JSON: `{ text, duration, language }`.

## 2) Voice output (TTS)

### Text preprocessing and chunking

- `cleanSpeechText` / `cleanForSpeech` remove stage-direction style text (`*...*`) and markdown artifacts from spoken output.
- `splitStreamBuffer` and `chunkSpeechText` split streaming responses into sentence-first chunks, and enforce per-request length safety.

### Provider strategy (`/api/tts`)

`POST /api/tts` supports engine selection:

- `edge`: Microsoft neural voices via `python3 -m edge_tts` (or `uvx edge-tts` fallback)
- `local`: local Kokoro server (`scripts/tts_local_server.py`)
- `cloud`: OpenAI TTS (`tts-1`)
- `auto`: tries **edge -> local -> cloud**

Other behavior:

- Validates voice/rate/local voice.
- Rejects overlong text (`MAX_TEXT_LENGTH = 2000`).
- Caches generated clips in `.cache/tts` by content hash.
- Attempts silence trimming with `ffmpeg` so sentence-to-sentence playback is smoother.

### Chat playback model (`page.tsx`)

- Streaming assistant text is fed incrementally into a speech buffer.
- Completed sentence chunks are queued for synthesis.
- Prefetch prepares multiple clips in parallel while current clip is playing.
- Playback consumes prepared clips sequentially for continuous speech.
- Supports **barge-in**: if the user starts speaking, current TTS playback is stopped.
- Active spoken sentence is exposed to UI for subtitle highlighting in chat bubbles.

## 3) Voice selection

- Voice defaults and validation are in `src/lib/tts.ts`.
- Companion voice preference supports EN/ZH and local voice ids.
- Missing/legacy companion voices are repaired via gender-based defaults (`src/lib/tts/gender-voice.ts`).

## 4) Environment and runtime dependencies

- `OPENAI_API_KEY` for STT and cloud TTS.
- `EVERHEART_TTS_MODE` (`local` / `cloud` / `auto`) for default TTS mode.
- Optional `TTS_PYTHON` for selecting Python executable.
- `ffmpeg` recommended (STT normalization + TTS silence trimming).
- `uvx` or `edge_tts` Python package needed for Edge path.
- Local Kokoro path requires a prepared Python venv and model dependencies.

## 5) Current design goals achieved

- Works with multiple fallback paths (browser STT, server STT, multi-provider TTS).
- Supports EN / 中文 voice interaction.
- Streams speech progressively instead of waiting for full reply.
- Keeps spoken output cleaner via markdown/action stripping and silence trimming.
- Maintains responsiveness with parallel prefetch + queue-based playback.
