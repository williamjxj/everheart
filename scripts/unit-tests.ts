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
import {
  chunkSpeechText,
  cleanSpeechText,
  splitSentences,
  splitStreamBuffer,
} from "@/lib/speech";
import {
  extractFactsRuleBased,
  extractEntitiesRuleBased,
  condenseEpisodeLocal,
} from "@/lib/memory/fact-extractor";
import { emptyMemory, addFacts, upsertEntity, pushEpisode } from "@/lib/memory/memory-store";
import { bundleForQuery } from "@/lib/memory/retrieval";

let failures = 0;
const pending: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const p = Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ok - ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`  FAIL - ${name}`);
      console.error(err);
    });
  pending.push(p);
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
    '"There you are." takes a slow breath. "Now we can start."'
  );
  assert.equal(
    cleanForSpeech('*He nods.* "Got it" — **really** got it.'),
    '"Got it" — really got it.'
  );
  assert.equal(cleanForSpeech("Hello   [已停止] world! 😊"), "Hello world!");
});

test("splitSentences handles English and Chinese", () => {
  assert.deepEqual(
    splitSentences("Hello! How are you? I'm fine."),
    ["Hello!", "How are you?", "I'm fine."]
  );
  assert.deepEqual(
    splitSentences("你好！今天天气不错。我们聊聊吧。"),
    ["你好！", "今天天气不错。", "我们聊聊吧。"]
  );
  assert.deepEqual(splitSentences("partial sentence"), ["partial sentence"]);
});

test("splitStreamBuffer keeps the trailing partial fragment", () => {
  const { complete, rest } = splitStreamBuffer(
    "Hello there. How are you? I'm doing"
  );
  assert.deepEqual(complete, ["Hello there.", "How are you?"]);
  assert.equal(rest, " I'm doing");
});

test("cleanSpeechText strips narration but keeps emphasis and links", () => {
  assert.equal(cleanSpeechText("*He smiles.* Hello **friend**."), "Hello friend.");
  assert.equal(
    cleanSpeechText("Read [the docs](https://example.com) now"),
    "Read the docs now"
  );
  // Markers are stripped but the heading/quote text is still spoken.
  assert.equal(cleanSpeechText("# Title\n> quote `code`"), "Title quote code");
  assert.equal(cleanSpeechText("A  B   C"), "A B C");
  // A single-asterisk action inside a sentence is removed, not spoken.
  assert.equal(cleanSpeechText('"Got it" — *she nods.*'), '"Got it" —');
});

test("chunkSpeechText keeps sentence boundaries and stays under the limit", () => {
  assert.deepEqual(chunkSpeechText("One. Two. Three!", 1600), [
    "One.",
    "Two.",
    "Three!",
  ]);
  const long = "很".repeat(500);
  const chunks = chunkSpeechText(long, 100);
  assert.ok(chunks.length >= 5, "long CJK text must be split");
  assert.ok(chunks.every((c) => c.length <= 100), "every chunk stays under limit");
  assert.equal(chunks.join(""), long, "splitting must not lose text");
});

console.log("companion memory");
test("rule-based facts are clean and bounded", () => {
  const facts = extractFactsRuleBased(
    "Hi, my name is Alex and I love hiking. I work as a nurse."
  );
  assert.ok(facts.some((f) => f.includes("name is Alex")));
  assert.ok(facts.some((f) => f.includes("likes hiking")));
  assert.ok(facts.some((f) => f.includes("works as a nurse")));
  assert.equal(facts.length, 3);
});

test("no junk facts from vague messages", () => {
  assert.deepEqual(
    extractFactsRuleBased("I am tired today, just want to rest."),
    []
  );
});

test("entities are captured with a note", () => {
  const entities = extractEntitiesRuleBased(
    "My dog Buddy is a golden retriever."
  );
  assert.equal(entities.length, 1);
  assert.equal(entities[0].name, "Buddy");
  assert.equal(entities[0].note, "User's dog");
});

test("memory store dedupes and recalls by relevance", () => {
  const m = emptyMemory();
  addFacts(m, extractFactsRuleBased("My name is Alex and I love hiking."));
  addFacts(m, extractFactsRuleBased("My name is Alex and I love hiking."));
  upsertEntity(m, "Buddy", "User's dog");
  pushEpisode(m, "Planned a Banff hiking trip.", ["hiking", "banff"]);

  assert.equal(m.userProfile.length, 2); // name + hiking, deduped on re-mention
  assert.equal(m.entities.length, 1);
  assert.equal(m.episodes.length, 1);

  const recalled = bundleForQuery(m, "what about hiking?");
  assert.ok(recalled.facts.some((f) => f.includes("hiking")));
  assert.ok(recalled.recalledEpisodes.some((e) => e.includes("hiking")));
});

test("episodic condensation produces a summary + keywords", () => {
  const ep = condenseEpisodeLocal([
    { role: "user", content: "I am planning a trip to Banff next week" },
    { role: "assistant", content: "That sounds amazing!" },
  ]);
  assert.ok(ep.summary.includes("Banff"));
  assert.ok(ep.keywords.includes("banff"));
});

Promise.all(pending).then(() => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll tests passed");
});
