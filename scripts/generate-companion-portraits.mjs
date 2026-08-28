#!/usr/bin/env node
/**
 * Generate consistent character portraits for Everheart companions using the
 * local ComfyUI (http://127.0.0.1:8188) with a reusable workflow.
 *
 *   node scripts/generate-companion-portraits.mjs
 *   node scripts/generate-companion-portraits.mjs --companion kai
 *
 * Output: public/companions/<id>/<shot>.png + public/companions/manifest.json
 * Consistency: each companion keeps one seed + one appearance block across all
 * shots; only the pose/expression suffix changes. A companion may opt into a
 * different workflow via "workflow": "nsfw" (uses workflow-nsfw.json,
 * e.g. an adult-tuned checkpoint for 18+ roles). Pass --companion <id> to
 * regenerate a single companion (other manifest entries are preserved).
 * Individual shots may override appearance / workflow / negative (e.g. an
 * NSFW companion's alternate shot can stay SFW for the public homepage).
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

/** Load a workflow template once per variant (portrait / nsfw / ...). */
const workflowCache = new Map();
async function getWorkflowTemplate(variant) {
  if (!workflowCache.has(variant)) {
    const file = join(HERE, "comfyui", `workflow-${variant}.json`);
    workflowCache.set(
      variant,
      JSON.parse(await readFile(file, "utf8")),
    );
  }
  return workflowCache.get(variant);
}

const onlyId = (() => {
  const args = process.argv.slice(2);
  const inline = args.find((a) => a.startsWith("--companion="));
  if (inline) return inline.split("=")[1];
  const flagAt = args.indexOf("--companion");
  return flagAt >= 0 ? args[flagAt + 1] : "";
})();

const companions = onlyId
  ? config.companions.filter((c) => c.id === onlyId)
  : config.companions;

if (companions.length === 0) {
  console.error(`No companion matches --companion=${onlyId || ""}`);
  process.exit(1);
}

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

async function buildWorkflow(companion, shot) {
  const variant = shot.workflow ?? companion.workflow ?? "portrait";
  const wf = structuredClone(await getWorkflowTemplate(variant));
  const prompt = [
    shot.appearance ?? companion.appearance,
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
  wf["7"].inputs.text = shot.negative ?? companion.negative ?? config.negative;
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

// When regenerating a single companion, preserve the other entries already
// recorded in the manifest so a partial run doesn't wipe the roster metadata.
let manifest;
try {
  manifest = onlyId
    ? JSON.parse(await readFile(join(OUT_DIR, "manifest.json"), "utf8"))
    : null;
} catch {
  manifest = null;
}
manifest = manifest ?? {
  companions: {},
};
manifest.generatedAt = new Date().toISOString();
manifest.comfyUrl = COMFY;
manifest.model = config.model;
manifest.width = config.width;
manifest.height = config.height;
manifest.steps = config.steps;
manifest.cfg = config.cfg;
manifest.sampler = config.sampler;
manifest.scheduler = config.scheduler;

let index = 0;
const total = companions.reduce((n, c) => n + c.shots.length, 0);

for (const companion of companions) {
  manifest.companions[companion.id] = {
    name: companion.name,
    seed: companion.seed,
    workflow: companion.workflow || "portrait",
    shots: {},
  };
  for (const shot of companion.shots) {
    index += 1;
    const wf = await buildWorkflow(companion, shot);
    const { prompt_id } = await comfy("/prompt", { prompt: wf, client_id: clientId });
    const image = await waitForImage(prompt_id, companion, shot);
    const destDir = join(OUT_DIR, companion.id);
    await mkdir(destDir, { recursive: true });
    const dest = join(destDir, `${shot.key}.png`);
    await downloadImage(image, dest);
    manifest.companions[companion.id].shots[shot.key] = {
      file: `${companion.id}/${shot.key}.png`,
      workflow: shot.workflow ?? companion.workflow ?? "portrait",
      prompt: [shot.appearance ?? companion.appearance, shot.suffix, config.style_tail].join(", "),
    };
    console.log(
      `[${index}/${total}] ${companion.id}/${shot.key} -> ${dest} (${image.filename})`,
    );
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nDone: ${total} images -> ${OUT_DIR}`);
