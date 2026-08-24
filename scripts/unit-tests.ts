/**
 * Zero-install unit tests for the offline engine (runs with the already
 * installed `tsx` — no test framework needed).
 *
 *   pnpm test
 */

import assert from "node:assert/strict";
import { respond } from "@/lib/offline/brain";
import { generatePersona, GRADIENTS } from "@/lib/offline/persona";
import { offlineCard } from "@/lib/offline/creation-fallback";
import { CharacterCardSchema } from "@/types/character-card";
import { cleanForSpeech } from "@/lib/tts";

let failures = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

console.log("offline brain");
test("returns an in-character reply", () => {
  const result = respond(
    { id: "t1", name: "Lyra", personality: ["warm"], interests: ["jazz"] },
    [],
    "hi there"
  );
  assert.ok(result.reply.length > 0);
  assert.equal(result.usedFallback, true);
  assert.equal(result.intent, "greeting");
});

test("extracts facts from user messages", () => {
  const result = respond({ id: "t2", name: "Kai" }, [], "my name is Alex and I like jazz");
  assert.ok(result.facts.some((f) => f.toLowerCase().includes("alex")));
  assert.ok(result.facts.some((f) => f.toLowerCase().includes("jazz")));
});

console.log("offline persona");
test("is deterministic for the same input", () => {
  const a = generatePersona({ archetype: "Mysterious stranger", vibe: "romance" });
  const b = generatePersona({ archetype: "Mysterious stranger", vibe: "romance" });
  assert.deepEqual(a, b);
});

test("always produces an 18+ persona", () => {
  for (const archetype of ["Mysterious stranger", "Childhood friend", "Cyberpunk hacker"]) {
    const persona = generatePersona({ archetype, vibe: "romance" });
    assert.ok(persona.age >= 18, `${archetype} age must be >= 18`);
    assert.ok(GRADIENTS.includes(persona.avatarGradient));
  }
});

console.log("offline creation fallback");
test("builds a SillyTavern card that passes schema validation", () => {
  const card = offlineCard({ archetype: "Childhood friend", vibe: "romance", nsfw: false });
  const parsed = CharacterCardSchema.safeParse(card);
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  assert.ok(card.first_mes.length > 0);
  assert.ok(card.description.length > 0);
  assert.equal(card.everheart?.isNsfw, false);
});

console.log("tts helpers");
test("cleans stage directions and keeps dialogue for speech", () => {
  assert.equal(cleanForSpeech("*She smiles.* Hello there."), "Hello there.");
  assert.equal(
    cleanForSpeech('"There you are." takes a slow breath. "Now we can start."'),
    "There you are. Now we can start."
  );
  assert.equal(cleanForSpeech("Hello   [已停止] world! 😊"), "Hello world!");
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll tests passed");
