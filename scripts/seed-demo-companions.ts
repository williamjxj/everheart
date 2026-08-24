/**
 * Seed three demo companions into localStorage-compatible JSON
 * (for browser) and also print them for manual DB insert later.
 *
 * Usage: npx tsx scripts/seed-demo-companions.ts
 */

const DEMO = [
  {
    id: "demo-elena",
    name: "Elena",
    isNsfw: false,
    archetype: "mysterious librarian / sorceress",
    portraitUrl: "/companions/elena/portrait.png",
  },
  {
    id: "demo-kai",
    name: "Kai",
    isNsfw: false,
    archetype: "warm barista / emotional support",
    portraitUrl: "/companions/kai/portrait.png",
  },
  {
    id: "demo-lyra",
    name: "Lyra",
    isNsfw: true,
    archetype: "confident intimate companion (18+)",
    portraitUrl: "/companions/lyra/portrait.png",
  },
  {
    id: "demo-mira",
    name: "Mira",
    isNsfw: false,
    archetype: "warm chef / comfort",
    portraitUrl: "/companions/mira/portrait.png",
  },
  {
    id: "demo-dante",
    name: "Dante",
    isNsfw: false,
    archetype: "charming art curator",
    portraitUrl: "/companions/dante/portrait.png",
  },
  {
    id: "demo-yuna",
    name: "Yuna",
    isNsfw: false,
    archetype: "music producer / night owl",
    portraitUrl: "/companions/yuna/portrait.png",
  },
  {
    id: "demo-cassian",
    name: "Cassian",
    isNsfw: false,
    archetype: "astronomy professor / wise",
    portraitUrl: "/companions/cassian/portrait.png",
  },
  {
    id: "demo-nova",
    name: "Nova",
    isNsfw: false,
    archetype: "adventure photographer",
    portraitUrl: "/companions/nova/portrait.png",
  },
];

console.log("Demo companions ready for the chat page (portraits in public/companions/):");
console.log(JSON.stringify(DEMO, null, 2));
console.log(
  "\nOpen /chat/demo-elena  /chat/demo-kai  /chat/demo-lyra  /chat/demo-mira  /chat/demo-dante  /chat/demo-yuna  /chat/demo-cassian  /chat/demo-nova",
);
console.log("They are auto-seeded into localStorage on first visit.");
