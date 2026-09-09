/**
 * Persist the demo roster into Supabase `eh_companion`.
 * Dynamic conversation data is intentionally NOT stored.
 *
 * Usage: pnpm db:seed-companions
 */

import { prisma } from "../src/lib/db/client";
import { DEMO_COMPANION_FILES, loadAllCompanions } from "../src/lib/companions/registry";

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

  const total = await prisma.companion.count({ where: { userId: user.id } });
  console.log(`companions in DB: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
