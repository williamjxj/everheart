/**
 * POST /api/stt
 * Body (multipart/form-data): { audio: File, language?: string }
 * Returns { text, duration, language }.
 *
 * Provider: OpenAI gpt-4o-transcribe (fallback whisper-1) when
 * OPENAI_API_KEY is set. Local dev optionally normalizes the upload to
 * 16kHz mono WAV with ffmpeg first; if ffmpeg is missing or fails the
 * original bytes pass through so transcription still works. Returns 503
 * without a key so the client can fall back to Web Speech.
 */

import { execFile } from "node:child_process";
import { File } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI file limit

function openaiClient(): OpenAI | null {
  return process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
}

/** "zh-CN" / "en-US" -> "zh" / "en"; passthrough for short codes. */
function languageCode(raw: string | null | undefined): string | undefined {
  const code = String(raw ?? "").trim();
  if (!code) return undefined;
  return code.includes("-") ? code.split("-")[0] : code;
}

/** Normalize to 16kHz mono WAV when ffmpeg is available; null on failure. */
async function normalizeWav(
  inPath: string,
  outPath: string
): Promise<Buffer | null> {
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", inPath, "-ar", "16000", "-ac", "1", "-f", "wav", outPath],
      { timeout: 30_000 }
    );
    return await readFile(outPath);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const client = openaiClient();
  if (!client) {
    return NextResponse.json(
      { error: "服务端语音识别未配置（OPENAI_API_KEY）" },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    if (!(audioFile instanceof File)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "audio too large (max 25MB)" }, { status: 400 });
    }

    const language = languageCode(String(formData.get("language") ?? ""));
    const arrayBuffer = await audioFile.arrayBuffer();
    let bytes: Uint8Array = Buffer.from(arrayBuffer);
    let fileName = audioFile.name;
    let fileType = audioFile.type;

    const tmpDir = await mkdtemp(join(tmpdir(), "eh-stt-"));
    try {
      const ext = /\.\w+$/.test(audioFile.name) ? audioFile.name.match(/\.\w+$/)![0] : ".bin";
      const inPath = join(tmpDir, `input${ext}`);
      const outPath = join(tmpDir, "normalized.wav");
      await writeFile(inPath, bytes);
      const normalized = await normalizeWav(inPath, outPath);
      if (normalized) {
        bytes = normalized;
        fileName = "audio.wav";
        fileType = "audio/wav";
      }

      const model = process.env.STT_MODEL || "gpt-4o-transcribe";
      const file = new File([new Uint8Array(bytes)], fileName, { type: fileType });

      let transcription;
      try {
        transcription = await client.audio.transcriptions.create({
          file,
          model,
          language,
          response_format: "json",
        });
      } catch (err) {
        if (model !== "whisper-1") {
          transcription = await client.audio.transcriptions.create({
            file,
            model: "whisper-1",
            language,
            response_format: "json",
          });
        } else {
          throw err;
        }
      }

      return NextResponse.json({
        text: transcription.text ?? "",
        duration: (transcription as any).duration ?? null,
        language: (transcription as any).language ?? language ?? null,
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    console.error("[stt]", err?.message || err);
    return NextResponse.json({ error: "STT failed" }, { status: 500 });
  }
}
