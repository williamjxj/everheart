/**
 * Local test for the creation pipeline (no Next.js needed).
 * Usage:
 *   DEEPSEEK_API_KEY=sk-... pnpm pipeline:test
 */

import { runCreationPipeline } from "../src/lib/llm/creation-pipeline";

async function main() {
  const input = {
    archetype: "mysterious librarian who knows forbidden knowledge",
    vibe: "warm but secretive, slightly teasing",
    nsfw: false,
    extraNotes: "Prefers candlelight and old books",
  };

  console.log("Running creation pipeline with input:", input);
  console.log("---");

  const result = await runCreationPipeline(input);

  console.log("\n=== FINAL CHARACTER CARD ===\n");
  console.log(JSON.stringify(result.card, null, 2));

  console.log("\n=== PERSONA ===\n");
  console.log(result.persona);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
