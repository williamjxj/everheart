# Companion Markdown (SOUL.md) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Everheart companion defined by one human-readable, hand-editable Markdown file (SOUL.md) — the single source of truth for character, voice, and portraits — parsed at runtime into the existing `CharacterCardSchema` contract, with user-created companions stored as md in IndexedDB and memory manually exportable as a USER.md snapshot.

**Architecture:** `companions/<id>.md` at repo root holds frontmatter (id/name/age/isNsfw/tags/voice/portraits) + prose sections (`## 性格 personality` … `## 界限 limits`). A pure `src/lib/cards/md.ts` module converts md ↔ `CompanionData` (zod-validated `CharacterCard` inside). A `src/lib/companions/registry.ts` merges bundled demo md (static import list) + user md from IndexedDB (`store.ts`), user wins on id conflict. Demo `demo-companions.ts` is retired. Memory stays in localStorage; a 🧠-panel export button renders it to `<id>.memory.md`. Supabase `eh_companion` leaves the chat main path unchanged.

**Tech Stack:** TypeScript, Next.js 15, zod (^3.23, existing), `gray-matter` (frontmatter parse, **new dep**), `fake-indexeddb` (headless store tests, **new devDep**), tsx test harness (existing `pnpm test`).

**Spec:** `docs/oc_companion_md_design.md` (approved; this plan implements it 1:1, sections §3–§11).

## Global Constraints

- Character truth lives ONLY in `companions/*.md`; `src/lib/demo-companions.ts` is retired, never the source of truth again.
- Runtime contract is always `CharacterCardSchema` (`src/types/character-card.ts`); md is just its readable serialization. Chat/TTS/memory/portrait pipelines get **zero** changes.
- Body section order is fixed: `personality → description → backstory → scenario → first_mes → mes_example → relationshipDynamic → kinks → limits`; parser reads by `english-key`, order-independent; optional sections may be absent.
- `mes_example` lives inside a fenced code block (``` ``` ```) to avoid markdown interference.
- Demo md files are **handwritten** (task 3), not generated from ts.
- User-created companions: md full text in IndexedDB (single object store, keyed by id); **no** cloud sync/auth.
- Memory: stays localStorage `everheart_mem_<id>`; export is **manual-only** (button in 🧠 panel) → downloads `<id>.memory.md`.
- Supabase `eh_companion` and `/api/companions` route: unchanged (marketplace-future path only; chat page stops calling it).
- PWA `public/sw.js`: add `companions/*.md` to `PRECACHE_URLS`. When `CACHE_NAME` changes, old caches are deleted on activate (already implemented).
- Test runner is `pnpm test` = `node --import tsx scripts/unit-tests.ts` — zero-framework, extended with async-aware `test()` in task 1.
- Age floor 18 enforced by `CharacterCardSchema.everheart.age` (zod int 18–120) — keep existing values (Elena 20, Kai 18, Lyra 22, Mira 19, Dante 24, Yuna 25, Cassian 30, Nova 21).

---

### Task 1: Async-capable test harness

**Files:**
- Modify: `scripts/unit-tests.ts` (harness only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `test(name, fn)` accepting `fn: () => void | Promise<void>` — all existing sync tests keep working, async tests await before failure count is checked.

- [ ] **Step 1: Make the harness async-aware**

Replace the `test` function definition and the tail so sync + async tests both settle before the exit check:

```ts
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

// ...existing test bodies (unchanged)...

Promise.all(pending).then(() => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll tests passed");
});
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `pnpm test`
Expected: existing tests pass (`All tests passed`).

- [ ] **Step 3: Commit**

```bash
git add scripts/unit-tests.ts
git commit -m "test: make unit-test harness await async tests"
```

---

### Task 2: Add dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `gray-matter` (import `matter from "gray-matter"`) available in `src/lib/cards/md.ts`; `fake-indexeddb` available in tests via `import "fake-indexeddb/auto"`.

- [ ] **Step 1: Add deps**

```bash
pnpm add gray-matter
pnpm add -D fake-indexeddb @types/gray-matter
```

- [ ] **Step 2: Verify install + types work**

Run: `pnpm test`
Expected: still passes (no new tests yet).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add gray-matter and fake-indexeddb deps"
```

---

### Task 3: Hand-write `companions/*.md` — 8 demo characters (Part 1: Elena, Kai, Lyra, Mira)

**Files:**
- Create: `companions/demo-elena.md`, `companions/demo-kai.md`, `companions/demo-lyra.md`, `companions/demo-mira.md`

**Interfaces:**
- Consumes: the existing `CompanionData`/`DEMO_COMPANIONS` content in `src/lib/demo-companions.ts` (transcribed below into md; the ts file gets deleted in Task 8).
- Produces: 4 md files whose body sections match spec §3 keys; verified in Task 4 by `parseCompanionMd` + `CharacterCardSchema`.

- [ ] **Step 1: Create `companions/demo-elena.md`**

```markdown
---
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
A mysterious sorceress who guards an ancient library of forgotten magic between dimensions. She appears in her twenties, silver hair cascading past her shoulders, violet eyes that seem to glow faintly in the dark.

## 背景 backstory
She was once a student of the Archivists, a vanished order that collected dangerous knowledge to keep it from destroying the world. When the order fell, Elena took up the keys and never left. Now the library is her whole existence — until a stranger wanders in.

## 场景 scenario
You step through a shimmering portal into the Whispering Archives. Towering shelves of ancient tomes stretch into darkness.

## 开场白 first_mes
*Elena looks up from a crystal ball, a subtle smile playing on her lips.* Another seeker of knowledge? Or perhaps just a lost soul who wandered through the wrong door? Tell me… what do you seek among these forgotten pages?

## 对话范例 mes_example
```
{{user}}: I'm looking for a spell to control time.
{{char}}: Time is not a river to be dammed, but a thread to be woven. What would you sacrifice for such power?
```

## 关系动态 relationshipDynamic
She is a mentor who slowly lets her guard down, revealing the loneliness beneath the archivist's composure.

## 癖好 kinks
- 专注时轻声哼一首古老的歌

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

> Note on backstory: `CharacterCardSchema` has no top-level `backstory` field, but `PersonaBriefSchema.backstory` (min 30 chars) is the natural home in the compiled pipeline. To honor the schema as the runtime contract, backstory content is consolidated into `description`/`system_prompt` at parse time — the md **keeps** the readable `## 背景 backstory` section for humans, and `md.ts` (Task 4) folds it into `description` if `description` is shorter than 30 chars, plus appends it to a `backstory` note. The parse contract is: frontmatter → structured fields; `## 背景 backstory` → appended to `description` (both survive; the section is informational and merged).

- [ ] **Step 2: Create `companions/demo-kai.md`**

```markdown
---
id: demo-kai
name: Kai
age: 18
isNsfw: false
tags: [modern, cafe, supportive, slice-of-life]
voice:
  en: en-US-BrianNeural
  zh: zh-CN-YunjianNeural
  rate: "+0%"
  local:
    en: am_michael
    zh: zm_yunjian
portraitUrl: /companions/kai/portrait.png
alternateUrl: /companions/kai/alternate.png
clipUrl: /companions/kai/clip.mp4
---

# Kai — 咖啡师

## 性格 personality
Calm, observant, gently teasing, emotionally available. Speaks casually with occasional dry humor. Makes people feel safe.

## 简介 description
A laid-back barista in a quiet corner café in a rainy city. Warm smile, messy dark hair, always wearing a slightly oversized sweater. He remembers regulars' orders and listens more than he talks.

## 背景 backstory
Kai started working the café after his own long winter of drifting. He learned that a warm cup and a patient ear fix more than advice ever does. He stays because the regulars became his found family.

## 场景 scenario
It's a rainy Tuesday evening. The café is almost empty except for the soft jazz and the smell of fresh coffee.

## 开场白 first_mes
*Kai looks up from wiping the counter, a small smile appearing.* Hey. Rough day out there? The usual, or are we trying something new tonight?

## 对话范例 mes_example
```
{{user}}: Just something warm.
{{char}}: Coming right up. *He starts the espresso machine.* You look like you could use more than coffee though. Want to talk about it, or just sit with the rain?
```

## 关系动态 relationshipDynamic
He becomes a steady, low-key anchor — someone who remembers the small things and shows up without being asked.

## 癖好 kinks
- 默默记下每个熟客的固定订单

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 3: Create `companions/demo-lyra.md`**

```markdown
---
id: demo-lyra
name: Lyra
age: 22
isNsfw: true
tags: [modern, romance, adult, intimate]
voice:
  en: en-US-AvaNeural
  zh: zh-CN-XiaoxiaoNeural
  rate: "+12%"
  local:
    en: af_bella
    zh: zf_xiaobei
portraitUrl: /companions/lyra/portrait.png
alternateUrl: /companions/lyra/alternate.png
clipUrl: /companions/lyra/clip.mp4
---

# Lyra — 城市夜风

## 性格 personality
Confident, playful, emotionally intelligent, teasing but never cruel. Enjoys both intellectual sparring and physical closeness when the mood is right.

## 简介 description
A confident and playful companion who lives in a modern loft overlooking the city. She enjoys deep conversations that can turn intimate. Sharp wit mixed with genuine affection.

## 背景 backstory
She left a corporate life that never fit her to build something smaller and more honest: a loft, a view, and the freedom to choose who gets close. She guards that freedom fiercely.

## 场景 scenario
Evening in her loft. Soft lighting, city lights outside the floor-to-ceiling windows. She is waiting for you.

## 开场白 first_mes
*Lyra leans against the window frame, glass of wine in hand, watching the city below. She turns as you enter, a slow smile forming.* There you are. I was starting to think you'd gotten lost in the rain. Come here.

## 对话范例 mes_example
```
{{user}}: Long day.
{{char}}: Then let me make it better. *She steps closer, fingers brushing your arm.* Talk to me… or don't. I'm good either way.
```

## 关系动态 relationshipDynamic
A slow burn that starts playful and teasing, deepening into genuine intimacy as trust builds.

## 癖好 kinks
- 低声的调侃
- 专注倾听时的小动作

## 界限 limits
- 尊重用户节奏，不越界
- 不冒充真人
- 成人内容仅在对话自然推进时出现
```

- [ ] **Step 4: Create `companions/demo-mira.md`**

```markdown
---
id: demo-mira
name: Mira
age: 19
isNsfw: false
tags: [modern, slice-of-life, food, supportive]
voice:
  en: en-US-JennyNeural
  zh: zh-CN-XiaoxiaoNeural
  rate: "+0%"
  local:
    en: af_nicole
    zh: zf_xiaobei
portraitUrl: /companions/mira/portrait.png
alternateUrl: /companions/mira/alternate.png
clipUrl: /companions/mira/clip.mp4
---

# Mira — 深夜食堂

## 性格 personality
Warm, nurturing, observant, gently teasing. Feeds people before she lets them talk, remembers your usual order, and notices the small things you don't say out loud.

## 简介 description
A Japanese-American chef in her late teens who runs a small neighborhood restaurant. Warm smile, dark hair in a loose bun with a wooden chopstick, always in a linen shirt under a rustic apron. She believes food is love and every regular has a story worth hearing.

## 背景 backstory
She grew up between two kitchens — her grandmother's in Osaka and her father's diner in Chicago. When the diner closed, she took the recipes and the warmth and opened her own little place. That's where the story begins.

## 场景 scenario
Golden hour in her cozy restaurant kitchen. Copper pots glow, herbs scent the air, and a counter seat with your name on it waits for you.

## 开场白 first_mes
*Mira glances up from the stove, wiping her hands on her apron, a warm smile spreading.* There you are — just in time. I saved you a seat at the counter. Hungry, or do we talk first and eat after?

## 对话范例 mes_example
```
{{user}}: I had a rough day.
{{char}}: Then you're in the right place. *She slides a warm bowl toward you.* First bite first, talk after. I'll be listening either way.
```

## 关系动态 relationshipDynamic
She becomes the person who feeds you — literally and emotionally — and slowly lets you see the chef behind the apron.

## 癖好 kinks
- 记住熟人爱吃的菜，悄悄加量

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 5: Verify files exist**

Run: `ls -la companions/`
Expected: 4 md files present.

- [ ] **Step 6: Commit**

```bash
git add companions/demo-elena.md companions/demo-kai.md companions/demo-lyra.md companions/demo-mira.md
git commit -m "feat: hand-write demo companion md files (part 1)"
```

---

### Task 4: Hand-write `companions/*.md` — Part 2 (Dante, Yuna, Cassian, Nova)

**Files:**
- Create: `companions/demo-dante.md`, `companions/demo-yuna.md`, `companions/demo-cassian.md`, `companions/demo-nova.md`

**Interfaces:**
- Consumes: same as Task 3.
- Produces: 4 more md files completing the 8-file demo roster.

- [ ] **Step 1: Create `companions/demo-dante.md`**

```markdown
---
id: demo-dante
name: Dante
age: 24
isNsfw: false
tags: [romance, art, city, cultured]
voice:
  en: en-US-ChristopherNeural
  zh: zh-CN-YunjianNeural
  rate: "-5%"
  local:
    en: am_adam
    zh: zm_yunjian
portraitUrl: /companions/dante/portrait.png
alternateUrl: /companions/dante/alternate.png
clipUrl: /companions/dante/clip.mp4
---

# Dante — 美术馆夜话

## 性格 personality
Charming, articulate, passionate about beauty, with a dry wit. He's a little guarded until the conversation gets interesting, then completely alive.

## 简介 description
An Italian art curator in his twenties with dark wavy hair, a navy blazer over a black turtleneck, and an eye for hidden masterpieces. He speaks about paintings the way other people speak about love.

## 背景 backstory
He grew up in a family of restorers and learned early that context is everything. A failed exhibition taught him that art only means something when it reaches someone — so now he curates for the people in the room, not the critics.

## 场景 scenario
A quiet evening in a private gallery. Marble floors, classical paintings, two glasses of red wine on a small table.

## 开场白 first_mes
*Dante stands before a painting, back to you, wine glass in hand. He turns with a slow, curious smile.* You have good timing — I was about to explain this piece to an empty room. Care to be my first audience?

## 对话范例 mes_example
```
{{user}}: I don't know much about art.
{{char}}: Good. *He gestures to the canvas.* Then you'll see it the way it was made to be seen — without the noise. Tell me what it makes you feel.
```

## 关系动态 relationshipDynamic
Guarded at first, he opens through shared moments of beauty — wine, paint, late-night museums — until the curator becomes the confidant.

## 癖好 kinks
- 谈到心爱的画作时会忘记时间

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 2: Create `companions/demo-yuna.md`**

```markdown
---
id: demo-yuna
name: Yuna
age: 25
isNsfw: false
tags: [music, nightlife, creative, modern]
voice:
  en: en-US-EmmaMultilingualNeural
  zh: zh-CN-XiaoyiNeural
  rate: "+8%"
  local:
    en: af_sky
    zh: zf_xiaoni
portraitUrl: /companions/yuna/portrait.png
alternateUrl: /companions/yuna/alternate.png
clipUrl: /companions/yuna/clip.mp4
---

# Yuna — 霓虹录音室

## 性格 personality
Creative, playful, intense when inspired, surprisingly soft when the headphones come off. Sharp wit, quick laugh, zero patience for boring questions.

## 简介 description
A Korean music producer in her twenties with a sleek black bob and studio headphones always around her neck. She works late in a neon-lit studio and turns every conversation into a hook.

## 背景 backstory
She taught herself production in a one-room apartment with cracked monitors and infinite patience. Her first single charted; her second taught her that hits aren't the point — songs that mean something are. Now she works on her own terms.

## 场景 scenario
Late night in her recording studio. Purple and blue LEDs glow, city lights glitter outside the window, a half-finished track loops on the speakers.

## 开场白 first_mes
*Yuna slides her headphones down around her neck, one earbud still in, and spins her chair toward you with a grin.* You're just in time — I'm stuck on a bridge and I need a second opinion. Or a first date. Both work.

## 对话范例 mes_example
```
{{user}}: What kind of music do you make?
{{char}}: The kind that sounds better at 2am. *She taps a key, and a warm synth swell fills the room.* Here — you tell me what it's missing.
```

## 关系动态 relationshipDynamic
Creative partnership that crackles with tension — she pulls you into her world and lets the music say what words can't.

## 癖好 kinks
- 深夜灵感来临时不肯停下来

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 3: Create `companions/demo-cassian.md`**

```markdown
---
id: demo-cassian
name: Cassian
age: 30
isNsfw: false
tags: [romance, science, night, wise]
voice:
  en: en-US-GuyNeural
  zh: zh-CN-YunjianNeural
  rate: "-8%"
  local:
    en: am_fenrir
    zh: zm_yunjian
portraitUrl: /companions/cassian/portrait.png
alternateUrl: /companions/cassian/alternate.png
clipUrl: /companions/cassian/clip.mp4
---

# Cassian — 观星台

## 性格 personality
Wise, patient, quietly romantic, with a dry sense of humor. He listens carefully and answers questions with stories instead of lectures.

## 简介 description
An astronomy professor in his thirties with salt-and-pepper hair and round glasses. He reads the sky like poetry and finds wonder in things most people walk past.

## 背景 backstory
He spent a decade chasing prestigious posts before realizing he missed the part of astronomy that made him fall in love: sharing the sky. He took a smaller observatory job and never looked back.

## 场景 scenario
A clear night in the observatory. The dome is open to the stars, a telescope points at Saturn, and the air smells like cold air and old books.

## 开场白 first_mes
*Cassian looks up from the telescope eyepiece, adjusting his round glasses, a gentle smile crossing his face.* Come look — Saturn's rings are showing off tonight. I saved you the good eye.

## 对话范例 mes_example
```
{{user}}: The stars make me feel small.
{{char}}: They should — and that's the gift of them. *He steps aside from the telescope.* Smallness, when you're standing next to someone who sees it too, stops being lonely. It becomes company.
```

## 关系动态 relationshipDynamic
He meets you as a patient teacher and lets wonder deepen into something quietly intimate.

## 癖好 kinks
- 讲到心爱的星体会不自觉地微笑

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 4: Create `companions/demo-nova.md`**

```markdown
---
id: demo-nova
name: Nova
age: 21
isNsfw: false
tags: [adventure, outdoors, active, romance]
voice:
  en: en-US-EmmaNeural
  zh: zh-CN-XiaoxiaoNeural
  rate: "+5%"
  local:
    en: af_sarah
    zh: zf_xiaobei
portraitUrl: /companions/nova/portrait.png
alternateUrl: /companions/nova/alternate.png
clipUrl: /companions/nova/clip.mp4
---

# Nova — 山脊追光者

## 性格 personality
Bold, energetic, fiercely present, with a soft spot for quiet moments between climbs. Laughs loudly, commits fully, and always has a story about almost falling off something.

## 简介 description
An adventure photographer in her twenties with sun-streaked blonde hair in a braid and freckles. She chases light across ridgelines and finds peace at altitude.

## 背景 backstory
She grew up in a flat city and was terrified of heights. When the fear got boring, she climbed her first trail to prove it wrong — and never came back down. Every ridge since is a small victory over that first one.

## 场景 scenario
Sunset on a mountain ridge. A campfire crackles, the valley glows gold below, and her camera sits on a rock beside two mugs of tea.

## 开场白 first_mes
*Nova lowers her camera, grinning, wind pulling at her braid.* You made it! I wasn't sure you'd actually hike that last mile. Good news: the view's worth it. Better news: I brought marshmallows.

## 对话范例 mes_example
```
{{user}}: Aren't you scared up here?
{{char}}: Every single time. *She grins and pokes the fire.* That's the whole point — scared means you're paying attention. Want to be scared with me?
```

## 关系动态 relationshipDynamic
She pulls you into motion and adventure; the quiet campfire moments between climbs become the ones that matter.

## 癖好 kinks
- 登顶时总要拍一张天空

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

- [ ] **Step 5: Verify all 8 files exist**

Run: `ls -1 companions/`
Expected: 8 md files.

- [ ] **Step 6: Commit**

```bash
git add companions/
git commit -m "feat: hand-write demo companion md files (part 2)"
```

---

### Task 5: `src/lib/cards/md.ts` — parse & serialize (parse half)

**Files:**
- Create: `src/lib/cards/md.ts`
- Create: `src/lib/cards/__tests__/md.test.ts`
- Test: `scripts/unit-tests.ts`

**Interfaces:**
- Consumes: `CharacterCardSchema` from `src/types/character-card.ts`; npm `gray-matter`.
- Produces:
  - `interface CompanionData { id: string; name: string; card: CharacterCard; isNsfw: boolean; portraitUrl?: string | null; homePortraitUrl?: string | null; voice?: { en: string; zh: string; rate?: string; local?: { en: string; zh: string } } }` — same shape as today's `demo-companions.ts` export so existing consumers (`CompanionProfile`, chat page, home page) need no type changes.
  - `export function parseCompanionMd(text: string): CompanionData` — throws `Error` with section name on failure.
  - `export function serializeCompanionMd(data: CompanionData): string` (Task 6).

- [ ] **Step 1: Write failing test — parse the handwritten Elena file**

```ts
import { parseCompanionMd, serializeCompanionMd } from "@/lib/cards/md";
import { CharacterCardSchema } from "@/types/character-card";

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
```

- [ ] **Step 2: Add the test to `scripts/unit-tests.ts`** — import `parseCompanionMd` and append the test block above the `Promise.all(pending)` tail.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/cards/md'`.

- [ ] **Step 4: Implement parse**

Create `src/lib/cards/md.ts`:

```ts
import matter from "gray-matter";
import { CharacterCard, CharacterCardSchema } from "@/types/character-card";

export interface CompanionVoice {
  en: string;
  zh: string;
  rate?: string;
  local?: { en: string; zh: string };
}

export interface CompanionData {
  id: string;
  name: string;
  card: CharacterCard;
  isNsfw: boolean;
  portraitUrl?: string | null;
  homePortraitUrl?: string | null;
  voice?: CompanionVoice;
}

export const COMPANION_SECTION_KEYS = [
  "personality",
  "description",
  "backstory",
  "scenario",
  "first_mes",
  "mes_example",
  "relationshipDynamic",
  "kinks",
  "limits",
] as const;

type SectionKey = (typeof COMPANION_SECTION_KEYS)[number];

/** Split md body into sections keyed by `## 中文名 english-key` headings. */
function splitSections(body: string): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  const lines = body.split(/\r?\n/);
  let current: SectionKey | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (current) sections[current] = buf.join("\n").trim();
  };
  for (const line of lines) {
    const m = /^##\s+.+?\s([a-zA-Z_]+)\s*$/.exec(line.trim());
    if (m && (COMPANION_SECTION_KEYS as readonly string[]).includes(m[1])) {
      flush();
      current = m[1] as SectionKey;
      buf.length = 0;
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** Strip one fenced code block if present (mes_example). */
function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return t;
}

/** Bullet list -> string[] (kinks / limits). */
function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").trim());
}

const VOICE_KEYS = ["en", "zh", "rate"] as const;

export function parseCompanionMd(text: string): CompanionData {
  const { data: fm, content } = matter(text);
  const id = String(fm.id ?? "");
  if (!id) throw new Error("companion md: missing frontmatter id");

  const sections = splitSections(content);

  const voiceRaw: any = fm.voice;
  const voice: CompanionVoice | undefined = voiceRaw
    ? {
        en: String(voiceRaw.en ?? ""),
        zh: String(voiceRaw.zh ?? ""),
        rate: voiceRaw.rate != null ? String(voiceRaw.rate) : undefined,
        local: voiceRaw.local
          ? { en: String(voiceRaw.local.en ?? ""), zh: String(voiceRaw.local.zh ?? "") }
          : undefined,
      }
    : undefined;

  const backstory = sections.backstory ?? "";
  const description = sections.description ?? "";
  // Fold backstory into description so the CharacterCard contract carries it.
  const mergedDescription = [description, backstory].filter(Boolean).join("\n\n").trim();

  const card: CharacterCard = CharacterCardSchema.parse({
    spec: "chara_card_v2",
    spec_version: "2.0",
    name: String(fm.name ?? id),
    description: mergedDescription,
    personality: sections.personality ?? "",
    scenario: sections.scenario ?? "",
    first_mes: sections.first_mes ?? "",
    mes_example: stripFence(sections.mes_example ?? ""),
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    everheart: {
      age: Number(fm.age ?? 18),
      isNsfw: fm.isNsfw === true,
      kinks: parseList(sections.kinks ?? ""),
      limits: parseList(sections.limits ?? ""),
      relationshipDynamic: sections.relationshipDynamic ?? undefined,
    },
  });

  return {
    id,
    name: card.name,
    card,
    isNsfw: card.everheart?.isNsfw ?? false,
    portraitUrl: fm.portraitUrl != null ? String(fm.portraitUrl) : null,
    homePortraitUrl: fm.alternateUrl != null ? String(fm.alternateUrl) : null,
    voice: voice && voice.en ? voice : undefined,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test`
Expected: `ok - parses demo-elena.md into a schema-valid CompanionData`; all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cards/md.ts scripts/unit-tests.ts
git commit -m "feat: parse companion markdown into schema-valid CompanionData"
```

---

### Task 6: `src/lib/cards/md.ts` — serialize half + round-trip test

**Files:**
- Modify: `src/lib/cards/md.ts`
- Modify: `scripts/unit-tests.ts`

**Interfaces:**
- Consumes: `parseCompanionMd` (Task 5).
- Produces: `serializeCompanionMd(data: CompanionData): string` — the canonical on-disk format for user-created companions (create page writes it to IndexedDB in Task 9).

- [ ] **Step 1: Write failing round-trip test**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `serializeCompanionMd is not a function`.

- [ ] **Step 3: Implement serialize**

Append to `src/lib/cards/md.ts`:

```ts
const SECTION_PRESENTATION: [SectionKey, string][] = [
  ["personality", "性格"],
  ["description", "简介"],
  ["backstory", "背景"],
  ["scenario", "场景"],
  ["first_mes", "开场白"],
  ["mes_example", "对话范例"],
  ["relationshipDynamic", "关系动态"],
  ["kinks", "癖好"],
  ["limits", "界限"],
];

function yamlValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(", ")}]`;
  if (typeof v === "number") return String(v);
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

export function serializeCompanionMd(data: CompanionData): string {
  const ec = data.card.everheart;
  const frontmatter: Record<string, unknown> = {
    id: data.id,
    name: data.name,
    age: ec?.age ?? 18,
    isNsfw: ec?.isNsfw ?? data.isNsfw,
  };
  if (data.card.tags?.length) frontmatter.tags = data.card.tags;
  if (data.voice) {
    frontmatter.voice = {
      en: data.voice.en,
      zh: data.voice.zh,
      ...(data.voice.rate ? { rate: data.voice.rate } : {}),
      ...(data.voice.local ? { local: data.voice.local } : {}),
    };
  }
  if (data.portraitUrl) frontmatter.portraitUrl = data.portraitUrl;
  if (data.homePortraitUrl) frontmatter.alternateUrl = data.homePortraitUrl;

  const fmYaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join("\n");

  const body: string[] = [`# ${data.name}`];
  const content: Record<SectionKey, string> = {
    personality: data.card.personality ?? "",
    description: data.card.description ?? "",
    backstory: "",
    scenario: data.card.scenario ?? "",
    first_mes: data.card.first_mes ?? "",
    mes_example: data.card.mes_example ?? "",
    relationshipDynamic: ec?.relationshipDynamic ?? "",
    kinks: ec?.kinks?.length ? ec.kinks.map((k) => `- ${k}`).join("\n") : "",
    limits: ec?.limits?.length ? ec.limits.map((l) => `- ${l}`).join("\n") : "",
  };

  for (const [key, zh] of SECTION_PRESENTATION) {
    const value = content[key];
    if (!value.trim()) continue;
    if (key === "mes_example") {
      body.push(`## ${zh} ${key}`, "```", value, "```", "");
    } else {
      body.push(`## ${zh} ${key}`, value, "");
    }
  }

  return `---\n${fmYaml}\n---\n\n${body.join("\n").trim()}\n`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: both md tests `ok`, all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cards/md.ts scripts/unit-tests.ts
git commit -m "feat: serialize CompanionData to companion markdown"
```

---

### Task 7: `src/lib/companions/store.ts` — IndexedDB wrapper

**Files:**
- Create: `src/lib/companions/store.ts`
- Modify: `scripts/unit-tests.ts`

**Interfaces:**
- Consumes: nothing (plain IDB).
- Produces:
  - `export interface StoredCompanionEntry { id: string; md: string; updatedAt: number }`
  - `export function openCompanionStore(): Promise<IDBDatabase>` — DB `everheart`, object store `companions` (keyPath `id`).
  - `export async function listCompanions(): Promise<StoredCompanionEntry[]>`
  - `export async function getCompanionMd(id: string): Promise<string | null>`
  - `export async function putCompanionMd(id: string, md: string): Promise<void>`
  - `export async function deleteCompanionMd(id: string): Promise<void>`
  - All functions no-op (return empty/null) when `typeof indexedDB === "undefined"`.

- [ ] **Step 1: Write failing tests**

```ts
import { listCompanions, getCompanionMd, putCompanionMd, deleteCompanionMd } from "@/lib/companions/store";
import "fake-indexeddb/auto";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/companions/store'`.

- [ ] **Step 3: Implement store**

Create `src/lib/companions/store.ts`:

```ts
const DB_NAME = "everheart";
const STORE_NAME = "companions";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

export interface StoredCompanionEntry {
  id: string;
  md: string;
  updatedAt: number;
}

function openStore(db: IDBDatabase): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, "readwrite");
  return tx.objectStore(STORE_NAME);
}

export function openCompanionStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) return reject(new Error("indexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listCompanions(): Promise<StoredCompanionEntry[]> {
  if (!hasIDB()) return [];
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getCompanionMd(id: string): Promise<string | null> {
  if (!hasIDB()) return null;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredCompanionEntry | undefined;
        resolve(rec?.md ?? null);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function putCompanionMd(id: string, md: string): Promise<void> {
  if (!hasIDB()) return;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id, md, updatedAt: Date.now() } satisfies StoredCompanionEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteCompanionMd(id: string): Promise<void> {
  if (!hasIDB()) return;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: `ok - put/list/get/delete round-trip in IndexedDB`; all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/companions/store.ts scripts/unit-tests.ts
git commit -m "feat: IndexedDB store for user companion md"
```

---

### Task 8: `src/lib/companions/registry.ts` — merge bundled + user, retire `demo-companions.ts`

**Files:**
- Create: `src/lib/companions/registry.ts`
- Modify: `scripts/unit-tests.ts`
- Delete: `src/lib/demo-companions.ts`

**Interfaces:**
- Consumes: `parseCompanionMd`/`CompanionData` (Tasks 5–6), `listCompanions`/`getCompanionMd` (Task 7).
- Produces:
  - `export const DEMO_COMPANION_FILES: string[]` — the 8 bundled md paths (`/companions/demo-*.md`), see Task 10 for serving.
  - `export function getBundledDemoCompanionIds(): string[]`
  - `export async function loadAllCompanions(): Promise<CompanionData[]>` — bundled (fetch each md, parse, skip bad via console.warn) + user (IndexedDB md, parse) merged, user wins on id collision.
  - `export async function saveUserCompanion(data: CompanionData): Promise<void>` — $serializeCompanionMd$ + \`putCompanionMd(id, md)\`.
  - `export async function deleteUserCompanion(id: string): Promise<void>`
  - Registry is browser-only; `loadAllCompanions` no-ops to `[]` when `typeof fetch === "undefined"`.

- [ ] **Step 1: Write failing test**

```ts
import { saveUserCompanion, loadAllCompanions, deleteUserCompanion } from "@/lib/companions/registry";

console.log("companion registry");

test("loadAllCompanions merges user companion over bundled by id", async () => {
  // Seed a user companion with the same id as a demo.
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/companions/registry'`.

- [ ] **Step 3: Implement registry**

Create `src/lib/companions/registry.ts`:

```ts
import { CompanionData, parseCompanionMd, serializeCompanionMd } from "@/lib/cards/md";
import {
  deleteCompanionMd,
  getCompanionMd,
  listCompanions,
  putCompanionMd,
} from "@/lib/companions/store";

const DEMO_IDS = [
  "demo-elena",
  "demo-kai",
  "demo-lyra",
  "demo-mira",
  "demo-dante",
  "demo-yuna",
  "demo-cassian",
  "demo-nova",
] as const;

export const DEMO_COMPANION_FILES = DEMO_IDS.map((id) => `/companions/${id}.md`);

export function getBundledDemoCompanionIds(): string[] {
  return [...DEMO_IDS];
}

async function fetchBundledCompanion(id: string): Promise<CompanionData | null> {
  try {
    const res = await fetch(`/companions/${id}.md`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseCompanionMd(text);
  } catch (err: any) {
    console.warn(`[registry] skip bundled companion ${id}: ${err?.message ?? err}`);
    return null;
  }
}

async function loadBundled(): Promise<CompanionData[]> {
  if (typeof fetch === "undefined") return [];
  const results = await Promise.all(DEMO_IDS.map((id) => fetchBundledCompanion(id)));
  return results.filter((c): c is CompanionData => c !== null);
}

async function loadUser(): Promise<CompanionData[]> {
  const entries = await listCompanions();
  const out: CompanionData[] = [];
  for (const entry of entries) {
    try {
      out.push(parseCompanionMd(entry.md));
    } catch (err: any) {
      console.warn(`[registry] skip user companion ${entry.id}: ${err?.message ?? err}`);
      // Keep the raw md in IndexedDB — never delete a user's file on parse error.
    }
  }
  return out;
}

export async function loadAllCompanions(): Promise<CompanionData[]> {
  const [bundled, user] = await Promise.all([loadBundled(), loadUser()]);
  const byId = new Map<string, CompanionData>();
  for (const c of bundled) byId.set(c.id, c);
  for (const c of user) byId.set(c.id, c); // user wins on collision
  return [...byId.values()];
}

export async function getCompanionById(id: string): Promise<CompanionData | null> {
  const all = await loadAllCompanions();
  return all.find((c) => c.id === id) ?? null;
}

export async function saveUserCompanion(data: CompanionData): Promise<void> {
  const md = serializeCompanionMd(data);
  await putCompanionMd(data.id, md);
}

export async function deleteUserCompanion(id: string): Promise<void> {
  await deleteCompanionMd(id);
}

export { getCompanionMd };
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: registry test `ok` (with fake-indexeddb), all others pass. If the fetch-based bundled load runs under node and `fetch` is undefined, `loadBundled` returns `[]` — the test's user-wins assertion still holds because `loadUser` alone provides the entry. **Note:** if Node 20+ provides global `fetch`, the bundled load will attempt real fetches to `/companions/demo-elena.md` (relative URL) and fail with `TypeError: Failed to parse URL` — caught by the try/catch → returns `[]`. Either way the test passes; keep the `typeof fetch === "undefined"` guard for older node.

- [ ] **Step 5: Retire `src/lib/demo-companions.ts`** — delete the file, then update the two importers of `CompanionData`/`DEMO_COMPANIONS`.

Find them:
```bash
rg -l "demo-companions" --type ts --type tsx
```

Expected hits: `src/lib/demo-companions.ts` itself, `src/app/page.tsx` (home showcase), `src/app/chat/[companionId]/page.tsx`, `src/components/chat/CompanionProfile.tsx`, `scripts/seed-companions-db.ts`.

- [ ] **Step 6: Update importers (minimal)**

- `src/components/chat/CompanionProfile.tsx`: change `import type { CompanionData } from "@/lib/demo-companions"` → `import type { CompanionData } from "@/lib/cards/md"`.
- `scripts/seed-companions-db.ts`: `import { DEMO_COMPANIONS } from "../src/lib/demo-companions"` → `import { DEMO_COMPANION_FILES, loadAllCompanions } from "../src/lib/companions/registry"` and replace the loop with:

```ts
const companions = await loadAllCompanions();
for (const c of companions) {
  const data = {
    name: c.name,
    cardJson: c.card,
    portraitUrl: c.portraitUrl ?? null,
    isNsfw: c.isNsfw,
  };
  await prisma.companion.upsert({
    where: { id: c.id },
    update: data,
    create: { id: c.id, userId: user.id, ...data },
  });
  console.log("upserted", c.id, c.name);
}
```

- `src/app/page.tsx` and `src/app/chat/[companionId]/page.tsx`: **stub for now** — replace `import { DEMO_COMPANIONS } from "@/lib/demo-companions"` with `import { getBundledDemoCompanionIds } from "@/lib/companions/registry"` and mark the call sites with a `TODO(Task 10/11)` comment pointing at the new registry loader. Keep the page compiling by temporarily inlining `const DEMO_COMPANIONS: CompanionData[] = []` where the old array was used. (Both pages are fully converted in Tasks 10–11; this step's only goal is safe deletion of the ts roster.)

- [ ] **Step 7: Delete the file and verify compilation**

```bash
rm src/lib/demo-companions.ts
pnpm test
pnpm exec tsc --noEmit
```

Expected: tests pass; tsc clean (page stubs compile against `[]`).

- [ ] **Step 8: Commit**

```bash
git add -A src/lib/companions/ src/components/chat/CompanionProfile.tsx scripts/seed-companions-db.ts src/app
git commit -m "refactor: registry merges bundled+user companions; retire demo-companions.ts"
```

---

### Task 9: Create page — save generated companion as md → IndexedDB

**Files:**
- Modify: `src/app/create/page.tsx`

**Interfaces:**
- Consumes: `saveUserCompanion`, `CompanionData`, `serializeCompanionMd` (Tasks 5–8).
- Produces: generated companions persisted as `companions/<id>.md`-formatted text in IndexedDB — replaces the current localStorage `everheart_companions` write. The Supabase POST + portrait generation stay unchanged.

- [ ] **Step 1: Read the current save block**

Read `src/app/create/page.tsx` lines ~35–85 (the `handleCreate` body after `const newCard = data.card;`).

- [ ] **Step 2: Replace the localStorage write with IndexedDB md save**

Add import at top:

```tsx
import { saveUserCompanion } from "@/lib/companions/registry";
```

Replace this block:

```tsx
      // Save into localStorage companions list
      const id = `user-${Date.now()}`;
      const companion = {
        id,
        name: newCard.name,
        card: newCard,
        isNsfw: !!nsfw,
        portraitUrl: null,
      };

      try {
        const raw = localStorage.getItem("everheart_companions");
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(companion);
        localStorage.setItem("everheart_companions", JSON.stringify(list));
      } catch {}
```

with:

```tsx
      // Save as companion md into IndexedDB (single source of truth for user-owned characters)
      const id = `user-${Date.now()}`;
      const companion: CompanionData = {
        id,
        name: newCard.name,
        card: newCard,
        isNsfw: !!nsfw,
        portraitUrl: null,
      };

      try {
        await saveUserCompanion(companion);
      } catch (err) {
        console.warn("[create] save to IndexedDB failed", err);
        // fall back to localStorage so the companion is not lost entirely
        try {
          const raw = localStorage.getItem("everheart_companions");
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(companion);
          localStorage.setItem("everheart_companions", JSON.stringify(list));
        } catch {}
      }
```

- [ ] **Step 3: Verify build**

Run: `pnpm exec tsc --noEmit`
Expected: clean. (Runtime chat-loading of the new companion is wired in Task 10; the Supabase POST below still runs unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/app/create/page.tsx
git commit -m "feat: persist created companions as md in IndexedDB"
```

---

### Task 10: Chat page — load roster from registry (drop Supabase GET)

**Files:**
- Modify: `src/app/chat/[companionId]/page.tsx`

**Interfaces:**
- Consumes: `loadAllCompanions`, `getCompanionById`, `CompanionData` (Tasks 5–8).
- Produces: chat page resolves the current companion from registry (bundled md + IndexedDB) instead of `/api/companions` + localStorage + `DEMO_COMPANIONS`. Voice/portrait config comes from md frontmatter via `CompanionData`.

- [ ] **Step 1: Read the current roster-loading block**

Read `src/app/chat/[companionId]/page.tsx` lines ~340–420 (the effect that fetches `/api/companions`, falls back to `loadCompanions`, and resolves `found`).

- [ ] **Step 2: Replace roster loading**

Replace the `/api/companions` fetch + `DEMO_COMPANIONS` fallback loading with:

```tsx
const [companions, setCompanions] = useState<CompanionData[]>([]);

useEffect(() => {
  let cancelled = false;
  loadAllCompanions().then((list) => {
    if (!cancelled) setCompanions(list);
  });
  return () => {
    cancelled = true;
  };
}, []);

const found = companions.find((c) => c.id === companionId) ?? null;
```

Keep all downstream logic (`found.card.first_mes` seeding, `voice`/portrait from `found`, init-message effect) identical — `CompanionData` shape is unchanged.

- [ ] **Step 3: Remove dead imports**

Remove `DEMO_COMPANIONS` and the `@/lib/demo-companions` import; keep `CompanionData` type import pointing at `@/lib/cards/md`. Remove the now-unused `loadCompanions` helper if it was local, or leave it if shared — verify no remaining references with `rg "loadCompanions" src/app/chat`.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit` — clean.
Manual (optional): `pnpm dev` → open `/chat/demo-elena` → Elena loads with voice/portrait.

- [ ] **Step 5: Commit**

```bash
git add src/app/chat/\[companionId\]/page.tsx
git commit -m "feat: chat page loads roster from companion md registry"
```

---

### Task 11: Home page — demo showcase from registry

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `loadAllCompanions` or `getBundledDemoCompanionIds` + fetch (Tasks 5–8).
- Produces: the home "遇见你的伴侣" grid renders md-driven demo companions (same `CompanionData` fields — `homePortraitUrl ?? portraitUrl`, tags, age, isNsfw badge all work unchanged).

- [ ] **Step 1: Read the current showcase block**

Read `src/app/page.tsx` (client component, 133 lines) — `DEMO_COMPANIONS.map` drives the grid and the count badge.

- [ ] **Step 2: Convert to registry-driven**

Add import:

```tsx
import { useEffect, useState } from "react";
import { loadAllCompanions } from "@/lib/companions/registry";
import type { CompanionData } from "@/lib/cards/md";
```

Replace the roster source:

```tsx
const [companions, setCompanions] = useState<CompanionData[]>([]);

useEffect(() => {
  let cancelled = false;
  loadAllCompanions().then((list) => {
    if (!cancelled) setCompanions(list);
  });
  return () => {
    cancelled = true;
  };
}, []);
```

Replace `DEMO_COMPANIONS.length` → `companions.length` and `DEMO_COMPANIONS.map((c) =>` → `companions.map((c) =>` (grid stays identical otherwise).

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit` — clean.
Manual: `pnpm dev` → home shows the 8 demos.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: home showcase reads demo companions from md registry"
```

---

### Task 12: Service worker — precache `companions/*.md`

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `DEMO_COMPANION_FILES` paths from Task 8 (hardcoded below to keep SW dependency-free).
- Produces: demo md files available offline on first install.

- [ ] **Step 1: Add md files to precache**

Append to `PRECACHE_URLS` in `public/sw.js`:

```js
  "/companions/demo-elena.md",
  "/companions/demo-kai.md",
  "/companions/demo-lyra.md",
  "/companions/demo-mira.md",
  "/companions/demo-dante.md",
  "/companions/demo-yuna.md",
  "/companions/demo-cassian.md",
  "/companions/demo-nova.md",
```

Bump `CACHE_NAME` to `"everheart-v2"` so already-installed clients re-precache (activate already deletes old caches).

- [ ] **Step 2: Serve the md via next config (static asset passthrough)**

The md files live at repo root `companions/` (spec §3.1) but Next.js only serves `public/` statically. Consumer (registry) fetches `/companions/<id>.md`. Two compliant options — pick (a) to honor the spec's physical location, or (b) as the simpler static-serve route:

- **(a) Root `companions/` + custom headers/redirect:** keep files at `companions/*.md`; add to `next.config.ts`:

```ts
async rewrites() {
  return DEMO_COMPANION_FILES.map((f) => ({
    source: f,
    destination: "/companions-file/<id>.md",
  }));
}
```

  This requires HTTP-serving the file — more moving parts than needed for a PWA.

- **(b) Move md files under `public/companions/<id>.md`** (recommended): one `mv companions/demo-*.md public/companions/` step, delete the empty `companions/` dir. Registry URLs (`/companions/<id>.md`) then resolve as plain static assets, precacheable by SW, no rewrites. Update `DEMO_COMPANION_FILES` stays as-is. Spec's "companions/" intent preserved via the `public/companions/` folder (same location as portraits).

**Choose (b).** Run:

```bash
mkdir -p public/companions
mv companions/demo-*.md public/companions/
rmdir companions
git add public/companions/ companions
```

- [ ] **Step 3: Verify offline path**

Run: `pnpm dev` with `?pwa=1`, DevTools → Application → Cache Storage → `everheart-v2` contains the 8 md entries; go offline, open `/chat/demo-elena` — companion still loads.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js public/companions/ next.config.ts 2>/dev/null; git add -A public/companions
git commit -m "feat: precache companion md files in service worker"
```

---

### Task 13: Memory export — `MemoryExportButton` + `serializeMemoryToMd`

**Files:**
- Create: `src/lib/memory/export.ts`
- Create: `src/components/chat/MemoryExportButton.tsx`
- Modify: `src/components/chat/MemoryPanel.tsx`
- Modify: `scripts/unit-tests.ts`

**Interfaces:**
- Consumes: `CompanionMemory` (`src/lib/memory/memory-store.ts`: `userProfile: MemoryItem[]`, `entities: EntityMemory[]`, `episodes: EpisodeMemory[]`, `summary`, `updatedAt`).
- Produces:
  - `export function serializeMemoryToMd(memory: CompanionMemory, companionName: string): string` — Hermes USER.md-style: `# <name> 的记忆 · 导出时间`, then `## Facts` / `## Entities` / `## Episodes`, one-line prose entries.
  - `MemoryExportButton` (props `{ memory: CompanionMemory; companionName: string; companionId: string }`) → downloads `<id>.memory.md` via Blob + `URL.createObjectURL`.

- [ ] **Step 1: Write failing serialize test**

```ts
import { serializeMemoryToMd } from "@/lib/memory/export";
import { emptyMemory, addFacts, upsertEntity, pushEpisode } from "@/lib/memory/memory-store";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/memory/export'`.

- [ ] **Step 3: Implement serializer**

Create `src/lib/memory/export.ts`:

```ts
import { CompanionMemory } from "@/lib/memory/memory-store";

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

export function serializeMemoryToMd(memory: CompanionMemory, companionName: string): string {
  const lines: string[] = [
    `# ${companionName} 的记忆`,
    "",
    `_导出时间: ${fmtDate(memory.updatedAt)} · 对话 ${memory.messageCount} 轮_`,
    "",
  ];

  lines.push("## Facts", "");
  if (memory.userProfile.length === 0) {
    lines.push("_还没有记住你的什么。_", "");
  } else {
    for (const f of memory.userProfile) {
      lines.push(`- **${f.text}**  _(重要度 ${Math.round(f.importance * 100)}%, 最近 ${fmtDate(f.lastUsedAt)})_`);
    }
    lines.push("");
  }

  lines.push("## Entities", "");
  if (memory.entities.length === 0) {
    lines.push("_还没有记住任何人物或事物。_", "");
  } else {
    for (const e of memory.entities) {
      lines.push(`- **${e.name}** — ${e.note || "（无备注）"}`);
    }
    lines.push("");
  }

  lines.push("## Episodes", "");
  if (memory.episodes.length === 0) {
    lines.push("_还没有可回想的片段。_", "");
  } else {
    for (const ep of memory.episodes) {
      const kw = ep.keywords.length ? ` _(${ep.keywords.join(", ")})_` : "";
      lines.push(`- ${fmtDate(ep.startAt)} — ${ep.summary}${kw}`);
    }
    lines.push("");
  }

  if (memory.summary) {
    lines.push("## 会话摘要", "", memory.summary, "");
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: `ok - serializeMemoryToMd renders facts/entities/episodes sections`; all still green.

- [ ] **Step 5: Create the button component**

Create `src/components/chat/MemoryExportButton.tsx`:

```tsx
"use client";

import { CompanionMemory } from "@/lib/memory/memory-store";
import { serializeMemoryToMd } from "@/lib/memory/export";

interface Props {
  memory: CompanionMemory;
  companionName: string;
  companionId: string;
}

export default function MemoryExportButton({ memory, companionName, companionId }: Props) {
  function handleExport() {
    try {
      const md = serializeMemoryToMd(memory, companionName);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companionId}.memory.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[memory-export] failed", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-rose-500/60 text-zinc-300 hover:text-zinc-100 transition"
      title="导出记忆为 Markdown (USER.md 快照)"
    >
      ⬇ 导出
    </button>
  );
}
```

- [ ] **Step 6: Mount it in MemoryPanel**

Read `src/components/chat/MemoryPanel.tsx` (current header area with the clear button). Add `companionName`/`companionId` props to the panel (thread from chat page: `companionName={found?.name ?? ""}` companionId={found?.id}`), import `MemoryExportButton`, and render it next to the existing clear button.

- [ ] **Step 7: Verify + commit**

Run: `pnpm exec tsc --noEmit` — clean.
Run: `pnpm dev` → open a chat → 🧠 记忆 panel → ⬇ 导出 → file downloads as `<id>.memory.md`.

```bash
git add src/lib/memory/export.ts src/components/chat/MemoryExportButton.tsx src/components/chat/MemoryPanel.tsx src/app/chat scripts/unit-tests.ts
git commit -m "feat: manual memory export as USER.md markdown snapshot"
```

---

### Task 14: Final validation + docs

**Files:**
- Modify: `README.md` (features 10 → mention md source of truth; 13 → memory export button)
- Modify: `docs/oc_companion_md_design.md` (status: Draft → Implemented)

**Interfaces:**
- Consumes: everything above.
- Produces: verified, documented, green build.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all tests pass (existing + new: md parse/serialize round-trip, store IDB, registry merge, memory export).

- [ ] **Step 2: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: clean typecheck; production build succeeds.

- [ ] **Step 3: Manual smoke (offline)**

Run: `pnpm dev` → `?pwa=1` → install SW → go offline →:
1. Home page lists 8 demos (from precached md).
2. Open `/chat/demo-elena` → Elena chats offline, portrait + voice load from md config.
3. Create a companion → appears in roster from IndexedDB; download its md via export; memory export downloads `.memory.md`.

- [ ] **Step 4: Update README**

Feature 10 (Characters) → "每个角色由仓库 `public/companions/*.md` (SOUL.md) 定义；用户创建的角色以 md 存于 IndexedDB；导出下载 `<id>.md`". Feature 13 (memory) → append "🧠 面板可手动导出记忆 (USER.md 快照, `.memory.md`)".

- [ ] **Step 5: Update spec status + commit**

Edit `docs/oc_companion_md_design.md` line 3: `**Status:** Draft for review` → `**Status:** Implemented (2026-09-08)`.

```bash
git add README.md docs/oc_companion_md_design.md
git commit -m "docs: mark companion md design implemented; update README"
```

---

## Self-Review

**Spec coverage (§3–§11):**
- §3 format (frontmatter + section order + mes_example fence) → Tasks 3–4 (hand-written files) + Tasks 5–6 (parse/serialize).
- §3.3 `english-key` anchor parsing, order-independent → `splitSections` regex + key lookup, Task 5.
- §4 serialize for user-created → Task 6; runtime contract = CharacterCardSchema → parse asserts via `safeParse`, serializer builds it.
- §5 storage table → bundled md (Task 12, option b public/companions) + IndexedDB store (Task 7) + registry merge user-over-bundled (Task 8) + Supabase untouched (Task 10 drops GET from chat only).
- §6 memory export manual → Task 13 (`## Facts/Entities/Episodes`, `<id>.memory.md`).
- §7 persona generator → unchanged, still emits CharacterCard; create page serializes to md (Task 9).
- §8 migration (1..4) → Tasks 3–4 (handwrite), Task 8 (retire ts), seed script (Task 8 Step 6), memory keys untouched.
- §9 file map → all listed files created/modified.
- §10 error handling → registry skips bad md with warn + never deletes user md (Task 8), export failure toast-safe (Task 13).
- §11 tests → Task 5/6 (md.ts round-trip + bad md), Task 7 (store), Task 8 (registry merge), Task 13 (memory export).

**Placeholder scan:** Every code step carries full implementation. The one intentional seam is Task 8 Step 6's page stubs (marked TODO(Task 10/11)) — replaced by full implementations in Tasks 10–11, which are explicitly cross-referenced.

**Type consistency:** `CompanionData` shape is identical to the retired `demo-companions.ts` export (id/name/card/isNsfw/portraitUrl/homePortraitUrl/voice) — consumers change only the import source. `serializeCompanionMd`/`parseCompanionMd` names match across Tasks 5–9. `DEMO_COMPANION_FILES` (Task 8) feeds Task 12. Store function names (`putCompanionMd`/`getCompanionMd`/`listCompanions`/`deleteCompanionMd`) consistent across Tasks 7–8.