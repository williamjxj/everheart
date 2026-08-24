/**
 * Persist the demo roster into Supabase `eh_companion`.
 * Dynamic conversation data is intentionally NOT stored.
 *
 * Usage: pnpm db:seed-companions
 */

import { prisma } from "../src/lib/db/client";
import { DEMO_COMPANIONS } from "../src/lib/demo-companions";

const DEMO_USER_ID = "demo-user";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      displayName: "Demo",
      email: "demo@everheart.local",
    },
  });

  for (const c of DEMO_COMPANIONS) {
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

  const total = await prisma.companion.count({ where: { userId: user.id } });
  console.log(`companions in DB: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
