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
  isFillerTurn,
} from "@/lib/memory/fact-extractor";
import {
  emptyMemory,
  addFacts,
  upsertEntity,
  pushEpisode,
  applyLlmDelta,
} from "@/lib/memory/memory-store";
import { serializeMemoryToMd } from "@/lib/memory/export";
import { bundleForQuery, factsForPrompt, boundaryFacts } from "@/lib/memory/retrieval";
import { shouldSummarize } from "@/lib/memory/context-assembler";
import { sanitizePlayerId } from "@/lib/auth/player-id";
import { parseCompanionMd, serializeCompanionMd, CompanionData } from "@/lib/cards/md";
import { listCompanions, getCompanionMd, putCompanionMd, deleteCompanionMd } from "@/lib/companions/store";
import "fake-indexeddb/auto";
import { saveUserCompanion, loadAllCompanions, deleteUserCompanion } from "@/lib/companions/registry";

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

console.log("companion md");

test("parses demo-elena.md into a schema-valid CompanionData", () => {
  const md = `---
id: demo-elena
name: Elena
age: 20
isNsfw: false
tags: [fantasy, magic, librarian, mysterious]
voice:
  en: en-US-AriaNeural
  zh: zh-CN-XiaoxiaoNeural
  rate: "+0%"
  local:
    en: af_heart
    zh: zf_xiaobei
portraitUrl: /companions/elena/portrait.png
alternateUrl: /companions/elena/alternate.png
clipUrl: /companions/elena/clip.mp4
---

# Elena — 神秘图书管理员

## 性格 personality
Intelligent, mysterious, protective of knowledge, slightly melancholic yet curious about visitors. Speaks in metaphors and values genuine curiosity.

## 简介 description
A mysterious sorceress who guards an ancient library of forgotten magic between dimensions.

## 场景 scenario
You step through a shimmering portal into the Whispering Archives.

## 开场白 first_mes
*Elena looks up from a crystal ball, a subtle smile.* Tell me… what do you seek?

## 对话范例 mes_example
\`\`\`
{{user}}: I'm looking for a spell to control time.
{{char}}: Time is not a river to be dammed, but a thread to be woven.
\`\`\`
`;
  const data = parseCompanionMd(md);
  assert.equal(data.id, "demo-elena");
  assert.equal(data.name, "Elena");
  assert.equal(data.isNsfw, false);
  assert.equal(data.voice?.en, "en-US-AriaNeural");
  assert.equal(data.voice?.rate, "+0%");
  assert.equal(data.portraitUrl, "/companions/elena/portrait.png");
  assert.equal(data.homePortraitUrl, "/companions/elena/alternate.png");
  assert.ok(data.card.personality.includes("Intelligent"));
  assert.ok(data.card.description.length > 0);
  assert.ok(data.card.first_mes.includes("Elena"));
  assert.ok(data.card.mes_example.includes("{{user}}"));
  // Round-trip: the card is the runtime contract
  const parsed = CharacterCardSchema.safeParse(data.card);
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
});

test("serialize -> parse round-trips a CompanionData", () => {
  const data: CompanionData = {
    id: "user-test",
    name: "Test",
    isNsfw: false,
    portraitUrl: "/companions/test/portrait.png",
    homePortraitUrl: "/companions/test/alternate.png",
    voice: { en: "en-US-AriaNeural", zh: "zh-CN-XiaoxiaoNeural", rate: "+0%", local: { en: "af_heart", zh: "zf_xiaobei" } },
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Test",
      description: "A friendly test companion with a heart of gold and a very long history.",
      personality: "Warm, curious, slightly mischievous, always ready with a joke.",
      scenario: "A warm room with a crackling fire.",
      first_mes: "*She smiles.* Welcome — make yourself at home.",
      mes_example: "{{user}}: Hi!\n{{char}}: Hello there!",
      tags: ["test"],
      everheart: { age: 20, isNsfw: false },
    },
  };
  const md = serializeCompanionMd(data);
  const parsed = parseCompanionMd(md);
  assert.equal(parsed.id, data.id);
  assert.equal(parsed.name, data.name);
  assert.equal(parsed.isNsfw, data.isNsfw);
  assert.equal(parsed.voice?.en, data.voice?.en);
  assert.equal(parsed.homePortraitUrl, data.homePortraitUrl);
  assert.equal(parsed.card.description, data.card.description);
  assert.equal(parsed.card.mes_example, data.card.mes_example);
  assert.deepEqual(parsed.card.tags, data.card.tags);
  const ok = CharacterCardSchema.safeParse(parsed.card);
  assert.equal(ok.success, true, ok.success ? "" : ok.error.message);
});

console.log("companion store");

test("put/list/get/delete round-trip in IndexedDB", async () => {
  const putMd = "---\nid: user-1\nname: Test\n---\n\n# Test";
  await putCompanionMd("user-1", putMd);
  const list = await listCompanions();
  assert.ok(list.some((e) => e.id === "user-1"), "entry appears in list");
  assert.equal(list.find((e) => e.id === "user-1")?.md, putMd);
  const got = await getCompanionMd("user-1");
  assert.equal(got, putMd);
  await deleteCompanionMd("user-1");
  assert.equal(await getCompanionMd("user-1"), null);
});

console.log("companion registry");

test("loadAllCompanions merges user companion over bundled by id", async () => {
  const demoId = "demo-elena";
  const userCard: CompanionData = {
    id: demoId,
    name: "Elena (custom)",
    isNsfw: false,
    card: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      name: "Elena (custom)",
      description: "A custom overwrite of the demo librarian with a much longer backstory to satisfy schema.",
      personality: "Friendly and warm, very approachable, always smiling.",
      scenario: "A cozy bookstore at noon.",
      first_mes: "*She waves.* Hey! Over here.",
      mes_example: "{{user}}: Hi\n{{char}}: Hey hey!",
      tags: ["custom"],
      everheart: { age: 21, isNsfw: false },
    },
  };
  await saveUserCompanion(userCard);
  const all = await loadAllCompanions();
  const found = all.find((c) => c.id === demoId);
  assert.ok(found, "demo-elena present");
  assert.equal(found?.name, "Elena (custom)", "user version wins");
  await deleteUserCompanion(demoId);
});

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

console.log("memory export");

test("serializeMemoryToMd renders facts/entities/episodes sections", () => {
  const m = emptyMemory();
  addFacts(m, ["User likes hiking on weekends", "User is a nurse"]);
  upsertEntity(m, "Buddy", "User's dog");
  pushEpisode(m, "Planned a Banff hiking trip together.", ["hiking", "banff"]);
  const md = serializeMemoryToMd(m, "Elena");
  assert.ok(md.includes("# Elena 的记忆"));
  assert.ok(md.includes("## Facts"));
  assert.ok(md.includes("User likes hiking"));
  assert.ok(md.includes("## Entities"));
  assert.ok(md.includes("Buddy"));
  assert.ok(md.includes("## Episodes"));
  assert.ok(md.includes("Banff"));
});

console.log("memory prompt selection");

test("factsForPrompt keeps user boundaries ahead of recalled facts", () => {
  const m = emptyMemory();
  addFacts(m, [
    "User likes hiking on weekends",
    "Boundary: don't call the user 哥哥",
    "User works as a nurse",
  ]);

  // Query matches nothing: boundaries must still make it into the prompt.
  const unmatched = factsForPrompt(m, bundleForQuery(m, "zzzz").facts);
  assert.equal(unmatched[0], "Boundary: don't call the user 哥哥");
  assert.equal(unmatched.length, 1);

  // Query matches a fact: boundary stays first, recalled fact follows.
  const matched = factsForPrompt(m, bundleForQuery(m, "what about hiking?").facts);
  assert.equal(matched[0], "Boundary: don't call the user 哥哥");
  assert.ok(matched.some((f) => f.includes("hiking")));
});

test("factsForPrompt dedupes and respects the cap", () => {
  const m = emptyMemory();
  addFacts(m, ["Boundary: no pet names", "User likes tea"]);
  const out = factsForPrompt(m, ["Boundary: no pet names", "User likes tea", "User likes tea"], 10);
  assert.deepEqual(out, ["Boundary: no pet names", "User likes tea"]);

  const capped = factsForPrompt(m, ["User likes tea"], 1);
  assert.deepEqual(capped, ["Boundary: no pet names"]);
});

test("boundaryFacts detects only boundary-prefixed facts", () => {
  const m = emptyMemory();
  addFacts(m, ["Boundary: don't swear", "User is from Osaka", "boundary: no spoilers"]);
  assert.deepEqual(boundaryFacts(m), ["Boundary: don't swear", "boundary: no spoilers"]);
});

console.log("memory llm delta");

test("applyLlmDelta merges facts without mutating the input", () => {
  const m = emptyMemory();
  addFacts(m, ["User likes tea"]);
  const merged = applyLlmDelta(m, { facts: ["User has a dog named Rex"] });

  assert.equal(m.userProfile.length, 1); // input untouched
  assert.equal(merged.userProfile.length, 2);
  assert.ok(merged.userProfile.some((f) => f.text.includes("Rex")));
});

test("applyLlmDelta stores a summary and arms the next fold window", () => {
  const m = emptyMemory();
  m.messageCount = 25;
  const summary = "The user and Elena have been planning a Banff trip and the user dislikes being called 哥哥.";
  const merged = applyLlmDelta(m, { facts: [], summary });

  assert.equal(merged.summary, summary);
  assert.equal(merged.lastSummaryAt, 25);
  // A fresh fold is only due after another full window.
  assert.equal(shouldSummarize(merged.messageCount, merged.lastSummaryAt), false);
  assert.equal(shouldSummarize(merged.messageCount + 20, merged.lastSummaryAt), true);
});

test("applyLlmDelta ignores no-op deltas and stub summaries", () => {
  const m = emptyMemory();
  m.summary = "Existing summary long enough to be kept.";
  assert.equal(applyLlmDelta(m, { facts: [] }), m);
  assert.equal(applyLlmDelta(m, { facts: [], summary: "ok" }), m);
});

test("isFillerTurn flags pleasantries but not fact-dense short messages", () => {
  for (const t of ["ok", "Thanks!", "哈哈", "在吗？", "嗯嗯"]) {
    assert.equal(isFillerTurn(t), true, `${t} should be filler`);
  }
  for (const t of ["我叫小明", "my name is Sam", "I have a dog named Rex"]) {
    assert.equal(isFillerTurn(t), false, `${t} should not be filler`);
  }
});

console.log("player identity");

test("sanitizePlayerId accepts uuids and rejects junk", () => {
  const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  assert.equal(sanitizePlayerId(uuid), uuid);
  assert.equal(sanitizePlayerId("  " + uuid + "  "), uuid);
  assert.equal(sanitizePlayerId("p-abc12345"), "p-abc12345");

  for (const bad of ["", "short", "has space", "semi;colon", "quote'", "a".repeat(65), null, undefined]) {
    assert.equal(sanitizePlayerId(bad), null, `${String(bad)} should be rejected`);
  }
});

Promise.all(pending).then(() => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll tests passed");
});
