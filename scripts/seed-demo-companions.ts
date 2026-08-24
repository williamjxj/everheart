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
  },
  {
    id: "demo-kai",
    name: "Kai",
    isNsfw: false,
    archetype: "warm barista / emotional support",
  },
  {
    id: "demo-lyra",
    name: "Lyra",
    isNsfw: true,
    archetype: "confident intimate companion (18+)",
  },
];

console.log("Demo companions ready for the chat page:");
console.log(JSON.stringify(DEMO, null, 2));
console.log("\nOpen /chat/demo-elena  /chat/demo-kai  /chat/demo-lyra");
console.log("They are auto-seeded into localStorage on first visit.");
