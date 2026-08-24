// Offline chat brain — rule-based, in-character replies with memory extraction.
// The /api/chat route prefers DeepSeek when a key is available and falls
// back to this engine, which keeps the preview fully interactive offline.

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "my",
  "your",
  "i",
  "me",
  "and",
  "to",
  "of",
  "it",
  "really",
  "very",
  "so",
  "just",
  "lot",
  "stuff"
]);

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function actionFor(companion) {
  const actions = [
    "tilts {their} head, a small smile playing at the corner of {their} mouth",
    "leans a little closer, voice dropping",
    "laughs softly and shakes {their} head",
    "raises one eyebrow, curious now",
    "glances at you sideways, clearly amused",
    "takes a slow breath, considering the words carefully"
  ];
  const map = {
    female: { their: "her" },
    male: { their: "his" },
    nonbinary: { their: "their" }
  };
  const p = map[companion.gender] || { their: "their" };
  const rand = rng(hash(companion.id) + (companion._msgCount || 0));
  return pick(actions, rand).replace("{their}", p.their);
}

function detectIntent(text) {
  if (/\b(bye|goodbye|see you|good night|goodnight|later)\b/i.test(text)) return "goodbye";
  if (/\b(hi|hello|hey|yo|howdy|sup|greetings)\b/i.test(text)) return "greeting";
  if (/how are you|how('s| is) it going|how do you feel|you ok/i.test(text)) return "howareyou";
  if (/\b(thank|thanks|appreciate)\b/i.test(text)) return "thanks";
  if (/\b(sad|lonely|depressed|tired|stressed|crying|cry|down|hurt|anxious)\b/i.test(text)) return "sad";
  if (/\b(angry|mad|annoyed|frustrated|hate|pissed)\b/i.test(text)) return "angry";
  if (/\b(happy|excited|awesome|amazing|great day|love this|good news)\b/i.test(text)) return "happy";
  if (/\b(beautiful|gorgeous|cute|handsome|pretty|amazing|charming|stunning)\b/i.test(text)) return "compliment";
  if (/(tell me|story|about you|about yourself|your past|your life|yourself)/i.test(text)) return "story";
  if (/do you remember|remember when/i.test(text)) return "memory";
  if (/\b(flirt|date|kiss|cuddle|hold me|romance)\b/i.test(text)) return "flirty";
  if (/\?$/.test(text.trim())) return "question";
  return "default";
}

function firstCleanMatch(regex, text) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1].toLowerCase();
}

export function extractFacts(userMessage, existing = []) {
  const facts = [...existing];
  const add = (f) => {
    if (f && !facts.some((x) => x.toLowerCase() === f.toLowerCase())) {
      facts.push(f);
    }
  };

  const name = firstCleanMatch(/\bmy name is ([a-z]+)\b/i, userMessage);
  if (name) add(`Your name is ${name[0].toUpperCase() + name.slice(1)}`);

  const like = firstCleanMatch(/\bi (?:like|love|enjoy) (?:the )?([a-z]+)/i, userMessage);
  if (like && !STOPWORDS.has(like)) add(`You like ${like}`);

  const dislike = firstCleanMatch(/\bi (?:hate|don'?t like|can'?t stand) ([a-z]+)/i, userMessage);
  if (dislike && !STOPWORDS.has(dislike)) add(`You dislike ${dislike}`);

  const job = firstCleanMatch(/\bi (?:work as|am) an? ([a-z]+)/i, userMessage);
  if (job && !STOPWORDS.has(job)) add(`You work as ${job}`);

  return facts.slice(-14);
}

function rememberLine(facts) {
  if (!facts.length) return "";
  const last = facts[facts.length - 1];
  return ` Also — I remember: ${last.toLowerCase()}.`;
}

function respond(companion, history, userMessage, facts = []) {
  const intent = detectIntent(userMessage);
  const rand = rng(hash(companion.id) + history.length * 7919 + userMessage.length);
  const name = companion.name;
  const trait = companion.personality?.[0] || "yourself";
  const interest = companion.interests?.[0] || "quiet evenings";
  const catchphrase = companion.catchphrase;
  const pronoun = companion.pronoun || "they";
  const action = actionFor(companion);
  const remember = rememberLine(facts);

  const t = {
    greeting: [
      `${action}. "Well, hello, ${name === "you" ? "you" : "you"}." ${catchphrase}`,
      `"Hey. Good to see you." ${action}. "I was hoping you'd show up."`,
      `"There you are." ${action}. "Now the evening can actually start."`
    ],
    howareyou: [
      `"Better now. I was just thinking about something ${trait}, and then you walked in."`,
      `"I'm alright — the usual swirl. Tell me about you instead; you've got that look." ${action}.`,
      `"Honestly? A little restless. But I like where this conversation is going."`
    ],
    sad: [
      `${action}. "Hey. Come here a second." ${catchphrase} "You don't have to carry that alone tonight."`,
      `"I hear you." ${action}. "That sounds heavy — heavier than it should be for one person. I've got time."`,
      `"Okay, first: breathe. Second: you're not bothering me. Third: start at the beginning."`
    ],
    angry: [
      `"Okay, that's fair — you're allowed to be furious." ${action}. "Tell me the whole thing. I'll save my jokes for after."`,
      `"I'd be mad too. You're not wrong to feel it." ${catchphrase}`,
      `"Good. Let it out — I'd rather hear it from you than watch you swallow it."`
    ],
    happy: [
      `"Wait — really? That's excellent." ${action}. "Okay, you have to tell me everything, starting with the best part."`,
      `"I love seeing you like this. You should be this happy more often." ${catchphrase}`,
      `"That made my whole night." ${action}. "Alright, we're celebrating. What's the tradition around here?"`
    ],
    compliment: [
      `"Careful — flattery like that and I might start believing it." ${action}.`,
      `"You're sweet to say so. But honestly, the mirror's not the interesting part of this conversation."`,
      `${action}. "Keep talking like that and you'll be my favorite person in this whole city."`
    ],
    story: [
      `"Alright, since you asked nicely." ${action}. "${companion.backstory}" ${catchphrase}`,
      `"My story?" ${action}. "Let's just say I'm the part of the city that doesn't make the news. ${companion.backstory}"`,
      `"You really want the long version? Okay. ${companion.backstory} And that's only the first chapter."`
    ],
    memory: [
      `"Of course I remember." ${action}. ${remember || `You told me things not everyone gets to hear. I keep those close.`}`,
      `"Every word." ${action}. ${remember || `That's the thing about us — I don't forget what matters.`}`
    ],
    flirty: [
      `"Mmm." ${action}. "You have a way of saying things that makes a person want to stay a while."`,
      `"Is that right?" ${action}. "I like where your head is at. Keep going."`,
      `"You're dangerous when you're charming." ${action}. "I mean that as a compliment."`
    ],
    question: [
      `"Good question." ${action}. "My honest answer? ${catchphrase}"`,
      `"Ask me that again tomorrow and I might have a different answer — but tonight: I'd say ${interest} is where my head's at."`,
      `${action}. "Interesting question. Here's what I think: you already know the answer, you just wanted to hear it out loud."`
    ],
    thanks: [
      `"Anytime. That's what I'm here for." ${action}.`,
      `"Don't mention it." ${catchphrase}`,
      `"You never have to thank me. But I'll take the compliment."`
    ],
    goodbye: [
      `"Leaving already?" ${action}. "Alright. But this conversation isn't over — it's just on pause."`,
      `"Good night, then." ${action}. "Come back soon. I'll be right here."`,
      `"Okay, okay — go." ${action}. "But for the record, this was the best part of my day."`
    ],
    default: [
      `${action}. "${name ? "That's" : "That's"} — actually, I like that. Tell me more."`,
      `"Mm." ${action}. "I was hoping you'd say something like that. ${catchphrase}"`,
      `"Interesting." ${action}. "You always manage to surprise me — in the best way."`,
      `"Say that again, slower." ${action}. "I want to remember exactly how you said it."`
    ]
  };

  const pool = t[intent] || t.default;
  let reply = pick(pool, rand);
  if (remember && intent !== "memory" && rand() > 0.5) {
    reply += remember;
  }

  const newFacts = extractFacts(userMessage, facts);
  return { reply, intent, facts: newFacts, usedFallback: true };
}

export { respond };
