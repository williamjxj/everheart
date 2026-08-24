/**
 * POST /api/companions/:id/portrait
 * Generates a portrait for a newly created companion with the local ComfyUI
 * (reuses scripts/comfyui/workflow-portrait.json), saves it to
 * public/companions/<id>/portrait.png, and persists the URL to eh_companion.
 * Blocks for the generation (~40-60s on M3).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";
const ROOT = resolve(process.cwd());
const PUBLIC_DIR = join(ROOT, "public", "companions");
const WORKFLOW_PATH = join(ROOT, "scripts", "comfyui", "workflow-portrait.json");
const STYLE_TAIL =
  "photorealistic, highly detailed skin texture, soft cinematic studio lighting, 85mm portrait, masterpiece";
const NEGATIVE =
  "cartoon, anime, painting, illustration, 3d render, cgi, deformed, disfigured, extra fingers, bad hands, bad anatomy, blurry, low quality, jpeg artifacts, watermark, text, logo, nude, explicit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companion = await prisma.companion.findUnique({ where: { id } });
    if (!companion) {
      return NextResponse.json({ error: "companion not found" }, { status: 404 });
    }

    const card = companion.cardJson as any;
    const appearance = String(card?.description || card?.personality || "")
      .replace(/\s+/g, " ")
      .slice(0, 400);
    const prompt = `Portrait of ${companion.name}, ${appearance}. portrait, looking at the viewer, ${STYLE_TAIL}`;

    const template = JSON.parse(await readFile(WORKFLOW_PATH, "utf8"));
    const seed = Number(
      `0x${createHash("sha1").update(id).digest("hex").slice(0, 8)}`
    );
    template["4"].inputs.ckpt_name = "majicmixRealistic_v7.safetensors";
    template["3"].inputs.seed = seed;
    template["6"].inputs.text = prompt;
    template["7"].inputs.text = NEGATIVE;
    template["9"].inputs.filename_prefix = `eh-portraits/${id}/portrait`;

    const res = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: template, client_id: `eh-${Date.now()}` }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`ComfyUI submit failed: HTTP ${res.status}`);
    }
    const { prompt_id } = await res.json();

    let image: { filename: string; subfolder?: string; type?: string } | null = null;
    const deadline = Date.now() + 1000 * 60 * 5;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const h = await (
        await fetch(`${COMFY_URL}/history/${prompt_id}`, {
          signal: AbortSignal.timeout(10_000),
        })
      ).json();
      const entry = h[prompt_id];
      if (!entry) continue;
      if (entry.status?.status_str === "error") {
        throw new Error("generation failed");
      }
      const images = Object.values(entry.outputs ?? {}).flatMap(
        (o: any) => o.images ?? []
      );
      if (images.length > 0) {
        image = images[0];
        break;
      }
    }
    if (!image) throw new Error("generation timed out");

    const viewUrl =
      `${COMFY_URL}/view?filename=${encodeURIComponent(image.filename)}` +
      `&subfolder=${encodeURIComponent(image.subfolder || "")}` +
      `&type=${encodeURIComponent(image.type || "output")}`;
    const imgRes = await fetch(viewUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) throw new Error("portrait download failed");
    const bytes = Buffer.from(await imgRes.arrayBuffer());

    const outDir = join(PUBLIC_DIR, id);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "portrait.png"), bytes);

    const portraitUrl = `/companions/${id}/portrait.png`;
    await prisma.companion.update({ where: { id }, data: { portraitUrl } });
    return NextResponse.json({ portraitUrl });
  } catch (err: any) {
    console.error("[portrait]", err?.message || err);
    return NextResponse.json(
      { error: "portrait generation failed" },
      { status: 500 }
    );
  }
}
