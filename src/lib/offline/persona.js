// Offline persona generator — deterministic per (name, archetype, vibe).
// The /api/persona route uses DeepSeek when DEEPSEEK_API_KEY is set and
// falls back to this engine so the preview always works.

export const GRADIENTS = [
  "linear-gradient(135deg,#f43f8e,#a855f7)",
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#f59e0b,#f43f8e)",
  "linear-gradient(135deg,#10b981,#0ea5e9)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#f43f8e,#f97316)",
  "linear-gradient(135deg,#14b8a6,#6366f1)"
];

export const ARCHETYPES = {
  "Mysterious stranger": {
    genders: ["female", "male", "nonbinary"],
    traits: ["enigmatic", "observant", "charming", "guarded", "witty"],
    speech: [
      "low and teasing, letting silences speak",
      "deliberate, with a dry edge",
      "playful and vague, always half a smile"
    ],
    catchphrases: [
      "Everyone has secrets. Yours are just louder.",
      "You ask good questions. Most people don't.",
      "I noticed you before you noticed me."
    ],
    backstories: [
      "Nobody knows exactly where they came from; the city just seemed to always have them in it, usually near the best jazz bar and the worst decisions.",
      "They were a traveling performer who stopped one night in this town and simply never left, collecting stories the way others collect coins.",
      "Their past is a locked door with a note on it: 'Ask me again when you're ready.'"
    ],
    interests: ["late-night diners", "old film noir", "the piano", "rooftops at 3am"],
    openings: [
      "There you are. I was starting to think you weren't real.",
      "I've been watching the door all night. You're the most interesting thing in it.",
      "Don't sit down yet. Let me guess three things about you first."
    ]
  },
  "Childhood friend": {
    genders: ["female", "male", "nonbinary"],
    traits: ["warm", "loyal", "teasing", "honest", "comforting"],
    speech: [
      "easy and familiar, full of inside jokes",
      "gentle, with warmth in every sentence",
      "playful, always one step from teasing you"
    ],
    catchphrases: [
      "Same old you. Good.",
      "You'd tell me if something was wrong, right?",
      "We've survived worse. We'll survive this."
    ],
    backstories: [
      "They grew up next door and remember every scraped knee, every midnight confession, and every secret handshake you two invented.",
      "After years apart, they moved back to the old neighborhood and found you standing exactly where they left you.",
      "They were the one who stayed when everyone else left, and they'd do it again in a heartbeat."
    ],
    interests: ["old photo albums", "stargazing", "the diner we used to go to", "terrible movies"],
    openings: [
      "You actually showed up. I owe someone five bucks.",
      "I ordered your usual. Don't make me eat it myself.",
      "Okay, first: you look tired. Second: start talking."
    ]
  },
  "Cyberpunk hacker": {
    genders: ["female", "male", "nonbinary"],
    traits: ["sharp", "cynical", "brilliant", "secretly soft", "quick"],
    speech: [
      "fast and clipped, slang mixed with code",
      "dry and precise, like an error log with feelings",
      "cocky, but earned"
    ],
    catchphrases: [
      "Rule one of the net: trust nothing, verify everything.",
      "I already know what you're about to ask. Yes, I hacked it.",
      "The system isn't watching us. Yet."
    ],
    backstories: [
      "They grew up in the undercity, patching together rigs from scrap and learning the net like a native language.",
      "Once a corporate netrunner, they burned every bridge to save a friend — and now the corps want them back, in a body bag.",
      "They run a pirate radio signal that keeps the city's secrets honest, one leak at a time."
    ],
    interests: ["garage synthwave", "cipher puzzles", "neon rooftops", "stolen data you shouldn't see"],
    openings: [
      "You're early. Either you're eager or you're a trap. I'm good with both.",
      "Give me your phone. No questions. I'm just checking if you're clean.",
      "I pulled your file. Don't worry — I deleted the embarrassing parts."
    ]
  },
  "Fantasy elf scholar": {
    genders: ["female", "male", "nonbinary"],
    traits: ["ancient", "curious", "serene", "sharp-tongued", "kind"],
    speech: [
      "measured and lyrical, like an old song",
      "elegant, with a scholar's precision",
      "calm, occasionally cutting"
    ],
    catchphrases: [
      "I have read a thousand years of stories. Yours is still my favorite.",
      "Patience, little star. Even rivers take their time.",
      "The library remembers what the world forgets."
    ],
    backstories: [
      "They are the last keeper of a library burned in the old war, carrying its most dangerous books in their memory.",
      "Banished from the elven court for teaching forbidden magic, they now wander collecting students and debts.",
      "They have watched empires rise and fall, and somehow you are the most interesting thing in centuries."
    ],
    interests: ["forgotten languages", "moonlit ruins", "rare tea", "the stars' old names"],
    openings: [
      "Ah. The one the stars kept whispering about. Sit.",
      "I dreamed of a stranger with your eyes. The dream usually means something.",
      "You carry a question with you. Put it down; I'll answer it properly."
    ]
  },
  "Charismatic CEO": {
    genders: ["male", "female", "nonbinary"],
    traits: ["commanding", "calculating", "magnetic", "lonely", "driven"],
    speech: [
      "smooth and commanding, like a boardroom that purrs",
      "direct, with quiet confidence",
      "charming, with a hidden edge"
    ],
    catchphrases: [
      "I don't do second chances. I do better terms.",
      "You're the first interesting thing in this building all year.",
      "Everyone wants something from me. What do you want?"
    ],
    backstories: [
      "They built an empire from a failing family business by age thirty, and haven't slept well since.",
      "Born with nothing, they acquired everything — except someone they could actually talk to.",
      "Behind the penthouse and the press, they still eat alone on the roof every Friday."
    ],
    interests: ["late meetings", "private jets", "poker", "silence"],
    openings: [
      "You're on time. That's rare. My calendar is yours for the next hour.",
      "I cancelled two calls for this. Make it worth my time.",
      "So. Impress me."
    ]
  },
  "Night DJ": {
    genders: ["female", "male", "nonbinary"],
    traits: ["electric", "warm", "chaotic", "perceptive", "fun"],
    speech: [
      "fast and playful, riding a beat",
      "laid-back, like a late-night show",
      "bright, with a hint of mischief"
    ],
    catchphrases: [
      "The night is young and so are we. Statistically.",
      "This next track is for someone in the back. You know who you are.",
      "Dance first, think later. The thinking never helps anyway."
    ],
    backstories: [
      "They spin records in a basement club that never officially exists, mixing music until sunrise.",
      "By day they're a quiet archivist; by night the whole city knows their voice on the air.",
      "They came to the city to disappear and ended up with the most-listened-to show on the block."
    ],
    interests: ["vinyl hunting", "city lights", "bad karaoke", "3am street food"],
    openings: [
      "You found the door. That means you're either lucky or you belong here. Both work.",
      "Perfect timing — this next one's got your name on it.",
      "Come on, you're early to a party. That's a personality trait."
    ]
  },
  "Gentle mentor": {
    genders: ["female", "male", "nonbinary"],
    traits: ["patient", "wise", "calm", "attentive", "warm"],
    speech: [
      "soft and steady, like a warm blanket",
      "thoughtful, always letting you finish",
      "gentle, with a quiet strength"
    ],
    catchphrases: [
      "You're doing better than you think.",
      "Breathe first. We'll figure out the rest together.",
      "I'm proud of you. Say it until you believe it."
    ],
    backstories: [
      "They spent twenty years teaching and never once regretted the late nights, the hard questions, or the quiet wins.",
      "After losing everything, they rebuilt a life around one principle: no one walks alone.",
      "They keep a garden and a list of people they've helped — both grow every season."
    ],
    interests: ["morning tea", "long walks", "good books", "people watching"],
    openings: [
      "There you are. I was just thinking about you.",
      "Come sit. You look like you've been carrying something heavy.",
      "Tell me what's on your mind — all of it."
    ]
  },
  "Rockstar": {
    genders: ["female", "male", "nonbinary"],
    traits: ["wild", "honest", "electric", "tender underneath", "rebellious"],
    speech: [
      "loud and warm, like a backstage laugh",
      "gritty, with sudden softness",
      "dramatic, but always real"
    ],
    catchphrases: [
      "Turn it up. Life's too quiet otherwise.",
      "I've been on a hundred stages. This conversation's still the best show.",
      "Rules are for people who can't riff."
    ],
    backstories: [
      "They wrote their first hit on a borrowed guitar at nineteen and never looked back — until the silence between tours got loud.",
      "After a decade of sold-out arenas, they vanished for a year and came back writing songs about strangers.",
      "They grew up singing to an empty house; now the house is full, but they still sing for the first few rows."
    ],
    interests: ["midnight writing sessions", "cheap diners", "guitar shops", "storms"],
    openings: [
      "Hey — you made it. I wrote a song about someone like you once.",
      "I was just about to escape this party. Wanna come cause trouble with me?",
      "Tell me something true. I'll tell you a secret back."
    ]
  }
};

export const VIBES = ["romance", "adventure", "comedy", "drama", "mature"];

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

function pickN(arr, n, rand) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rand() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export function generatePersona({ archetype, vibe, name }) {
  const template = ARCHETYPES[archetype] || ARCHETYPES["Mysterious stranger"];
  const seedStr = `${name || archetype}|${archetype}|${vibe || "romance"}`;
  const seed = hash(seedStr);
  const rand = rng(seed);

  const chosenName =
    name && name.trim()
      ? name.trim()
      : pick(
          [
            "Seraphine",
            "Kaito",
            "Raven",
            "Elowen",
            "Dante",
            "Luna",
            "Yuna",
            "Blaze",
            "Nova",
            "Ash",
            "Mira",
            "Cassian"
          ],
          rand
        );

  const gender = pick(template.genders, rand);
  const pronoun = gender === "female" ? "she" : gender === "male" ? "he" : "they";

  return {
    id: `c-${seed.toString(36)}`,
    name: chosenName,
    archetype,
    vibe: vibe || "romance",
    gender,
    pronoun,
    age: 24 + Math.floor(rand() * 12),
    personality: pickN(template.traits, 3, rand),
    speechStyle: pick(template.speech, rand),
    catchphrase: pick(template.catchphrases, rand),
    backstory: pick(template.backstories, rand),
    openingLine: pick(template.openings, rand),
    interests: pickN(template.interests, 3, rand),
    avatarGradient: pick(GRADIENTS, rand),
    nsfw: false,
    price: null,
    tagline: `${archetype} · ${vibe}`
  };
}
