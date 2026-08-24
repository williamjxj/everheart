#!/usr/bin/env node
/**
 * Generate consistent character portraits for Everheart companions using the
 * local ComfyUI (http://127.0.0.1:8188) with a reusable workflow.
 *
 *   node scripts/generate-companion-portraits.mjs
 *
 * Output: public/companions/<id>/<shot>.png + public/companions/manifest.json
 * Consistency: each companion keeps one seed + one appearance block across all
 * shots; only the pose/expression suffix changes.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188";
const OUT_DIR = join(ROOT, "public", "companions");

const config = JSON.parse(
  await readFile(join(HERE, "comfyui", "companions.json"), "utf8"),
);
const workflowTemplate = JSON.parse(
  await readFile(join(HERE, "comfyui", "workflow-portrait.json"), "utf8"),
);

const clientId = randomUUID();

async function comfy(pathname, body) {
  const res = await fetch(`${COMFY}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`ComfyUI ${pathname} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function buildWorkflow(companion, shot) {
  const wf = structuredClone(workflowTemplate);
  const prompt = [
    companion.appearance,
    shot.suffix,
    config.style_tail,
  ].join(", ");
  wf["4"].inputs.ckpt_name = config.model;
  wf["3"].inputs.seed = companion.seed;
  wf["3"].inputs.steps = config.steps;
  wf["3"].inputs.cfg = config.cfg;
  wf["3"].inputs.sampler_name = config.sampler;
  wf["3"].inputs.scheduler = config.scheduler;
  wf["5"].inputs.width = config.width;
  wf["5"].inputs.height = config.height;
  wf["6"].inputs.text = prompt;
  wf["7"].inputs.text = config.negative;
  wf["9"].inputs.filename_prefix = `eh-portraits/${companion.id}/${shot.key}`;
  return wf;
}

async function waitForImage(promptId, companion, shot) {
  const deadline = Date.now() + 1000 * 60 * 15; // 15 min hard cap
  while (Date.now() < deadline) {
    const history = await comfy(`/history/${promptId}`);
    const entry = history[promptId];
    if (!entry) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (entry.status?.status_str === "error") {
      throw new Error(
        `Generation failed for ${companion.id}/${shot.key}: ${JSON.stringify(entry.status?.messages ?? [])}`,
      );
    }
    const images = Object.values(entry.outputs ?? {})
      .flatMap((o) => o.images ?? []);
    if (images.length > 0) return images[0];
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${companion.id}/${shot.key}`);
}

async function downloadImage(image, dest) {
  const url = `${COMFY}/view?filename=${encodeURIComponent(image.filename)}`
    + `&subfolder=${encodeURIComponent(image.subfolder || "")}`
    + `&type=${encodeURIComponent(image.type || "output")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`view -> HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  comfyUrl: COMFY,
  model: config.model,
  width: config.width,
  height: config.height,
  steps: config.steps,
  cfg: config.cfg,
  sampler: config.sampler,
  scheduler: config.scheduler,
  companions: {},
};

let index = 0;
const total = config.companions.reduce((n, c) => n + c.shots.length, 0);

for (const companion of config.companions) {
  manifest.companions[companion.id] = {
    name: companion.name,
    seed: companion.seed,
    shots: {},
  };
  for (const shot of companion.shots) {
    index += 1;
    const wf = buildWorkflow(companion, shot);
    const { prompt_id } = await comfy("/prompt", { prompt: wf, client_id: clientId });
    const image = await waitForImage(prompt_id, companion, shot);
    const destDir = join(OUT_DIR, companion.id);
    await mkdir(destDir, { recursive: true });
    const dest = join(destDir, `${shot.key}.png`);
    await downloadImage(image, dest);
    manifest.companions[companion.id].shots[shot.key] = {
      file: `${companion.id}/${shot.key}.png`,
      prompt: [companion.appearance, shot.suffix, config.style_tail].join(", "),
    };
    console.log(
      `[${index}/${total}] ${companion.id}/${shot.key} -> ${dest} (${image.filename})`,
    );
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nDone: ${total} images -> ${OUT_DIR}`);
