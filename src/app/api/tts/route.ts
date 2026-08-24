/**
 * POST /api/tts
 * Body: { text, voice?, rate? }
 * Returns an audio/mpeg stream of the companion speaking `text`.
 * Generated with `uvx edge-tts` (Microsoft neural voices) and cached on disk
 * by content hash, so repeated lines don't regenerate.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import {
  cleanForSpeech,
  DEFAULT_RATE,
  DEFAULT_VOICE,
  isValidRate,
  TTS_VOICES,
} from "@/lib/tts";

const execFileAsync = promisify(execFile);
const CACHE_DIR = resolve(process.cwd(), ".cache", "tts");
const MAX_TEXT_LENGTH = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = cleanForSpeech(String(body.text ?? ""));
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "text too long" }, { status: 400 });
    }

    const voice = String(body.voice ?? DEFAULT_VOICE);
    if (!TTS_VOICES.has(voice)) {
      return NextResponse.json(
        { error: `unsupported voice: ${voice}` },
        { status: 400 },
      );
    }
    const rate = isValidRate(String(body.rate ?? "")) ? String(body.rate) : DEFAULT_RATE;

    const key = createHash("sha1").update(`${text}|${voice}|${rate}`).digest("hex");
    await mkdir(CACHE_DIR, { recursive: true });
    const target = join(CACHE_DIR, `${key}.mp3`);

    try {
      const cached = await readFile(target);
      return new Response(new Uint8Array(cached), { headers: AUDIO_HEADERS });
    } catch {
      /* not cached yet */
    }

    const tmp = join(CACHE_DIR, `${key}.tmp.mp3`);
    await execFileAsync(
      "uvx",
      [
        "edge-tts",
        "--text",
        text,
        "--voice",
        voice,
        "--rate",
        rate,
        "--write-media",
        tmp,
      ],
      { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const audio = await readFile(tmp);
    await rename(tmp, target).catch(() => {});

    return new Response(new Uint8Array(audio), { headers: AUDIO_HEADERS });
  } catch (err: any) {
    console.error("[tts]", err?.message || err);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "public, max-age=86400",
};
