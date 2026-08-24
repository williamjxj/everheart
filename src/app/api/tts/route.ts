/**
 * POST /api/tts
 * Body: { text, voice?, rate?, localVoice?, engine? }
 * Returns audio of the companion speaking `text`.
 *
 * Providers (engine = "auto" default):
 *   1. edge  – Microsoft neural voices via `python3 -m edge_tts`
 *              (falls back to `uvx edge-tts`), requires network.
 *   2. local – Kokoro TTS via a persistent local server
 *              (scripts/tts_local_server.py), works offline.
 * Auto tries edge first and falls back to local when the network call fails.
 * Output is cached on disk by content hash.
 */

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import {
  cleanForSpeech,
  DEFAULT_RATE,
  DEFAULT_VOICE,
  isValidKokoroVoice,
  isValidRate,
  TTS_VOICES,
} from "@/lib/tts";

const execFileAsync = promisify(execFile);
const CACHE_DIR = resolve(process.cwd(), ".cache", "tts");
const MAX_TEXT_LENGTH = 2000;
const LOCAL_TTS_PORT = 8765;
const LOCAL_TTS_URL = `http://127.0.0.1:${LOCAL_TTS_PORT}`;
const ROOT = resolve(process.cwd());

function pickPython(): string {
  const candidates = [
    process.env.TTS_PYTHON,
    join(ROOT, ".venv-tts", "bin", "python"),
    "python3",
  ].filter(Boolean) as string[];
  return candidates[0];
}

async function synthWithEdge(text: string, voice: string, rate: string, out: string) {
  const args = [
    "-m",
    "edge_tts",
    "--text",
    text,
    "--voice",
    voice,
    "--rate",
    rate,
    "--write-media",
    out,
  ];
  try {
    await execFileAsync(pickPython(), args, {
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    return;
  } catch (err) {
    // Fall back to uvx (same CLI, no local module needed).
    await execFileAsync("uvx", ["edge-tts", ...args.slice(2)], {
      timeout: 90_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  }
}

async function localServerAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_TTS_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureLocalServer(): Promise<boolean> {
  if (await localServerAlive()) return true;
  const python = pickPython();
  const child = spawn(
    python,
    [join(ROOT, "scripts", "tts_local_server.py"), "--port", String(LOCAL_TTS_PORT)],
    { cwd: ROOT, detached: true, stdio: "ignore" },
  );
  child.unref();
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (await localServerAlive()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function synthWithLocal(text: string, voice: string, out: string) {
  if (!(await ensureLocalServer())) {
    throw new Error("local TTS server unavailable (is Kokoro installed?)");
  }
  const res = await fetch(`${LOCAL_TTS_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`local TTS HTTP ${res.status}: ${await res.text()}`);
  }
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
}

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
    const engine = String(body.engine ?? "auto");
    if (!["auto", "edge", "local"].includes(engine)) {
      return NextResponse.json({ error: "invalid engine" }, { status: 400 });
    }
    const localVoice = String(body.localVoice ?? "");
    if (localVoice && !isValidKokoroVoice(localVoice)) {
      return NextResponse.json({ error: "invalid local voice" }, { status: 400 });
    }

    const key = createHash("sha1")
      .update(`${text}|${voice}|${rate}|${engine}|${localVoice}`)
      .digest("hex");
    await mkdir(CACHE_DIR, { recursive: true });
    const target = join(CACHE_DIR, `${key}.mp3`);

    try {
      const cached = await readFile(target);
      return new Response(new Uint8Array(cached), { headers: AUDIO_HEADERS });
    } catch {
      /* not cached yet */
    }

    const tmp = join(CACHE_DIR, `${key}.tmp.mp3`);
    let mime = "audio/mpeg";
    if (engine === "local") {
      await synthWithLocal(text, localVoice || "af_heart", tmp);
      mime = "audio/wav";
    } else {
      try {
        await synthWithEdge(text, voice, rate, tmp);
      } catch (edgeErr) {
        if (engine === "edge") throw edgeErr;
        // Network path failed → fall back to the local Kokoro server.
        await synthWithLocal(text, localVoice || "af_heart", tmp);
        mime = "audio/wav";
      }
    }
    const audio = await readFile(tmp);
    await rename(tmp, target).catch(() => {});

    return new Response(new Uint8Array(audio), {
      headers: { ...AUDIO_HEADERS, "Content-Type": mime },
    });
  } catch (err: any) {
    console.error("[tts]", err?.message || err);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "public, max-age=86400",
};
