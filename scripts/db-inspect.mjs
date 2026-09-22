/**
 * Read-only database inspector for the `eh_*` tables.
 *
 *   node --env-file=.env scripts/db-inspect.mjs
 *
 * Useful because `prisma db push` does not work against this Supabase project:
 * introspection fails on a cross-schema FK from another project's tables
 * (`public.dr_users` → `auth.users`). Schema changes therefore go through
 * `prisma db execute --file prisma/sql/<name>.sql` + `prisma generate`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = await prisma.$queryRawUnsafe(
  "select table_name from information_schema.tables where table_schema = 'public' and table_name like 'eh%' order by 1"
);
console.log("eh* tables:");
for (const t of tables) console.log("  -", t.table_name);

const cols = await prisma.$queryRawUnsafe(
  "select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name like 'eh%' order by table_name, ordinal_position"
);
console.log("\ncolumns:");
for (const c of cols) {
  console.log(
    `  ${c.table_name}.${c.column_name} ${c.data_type} ${c.is_nullable === "YES" ? "NULL" : "NOT NULL"}`
  );
}

console.log("\nrow counts:");
for (const t of ["eh_user", "eh_companion", "eh_message", "eh_memory_fact", "eh_summary"]) {
  try {
    const rows = await prisma.$queryRawUnsafe(`select count(*)::int as n from "${t}"`);
    console.log(`  ${t}: ${rows[0].n}`);
  } catch (e) {
    console.log(`  ${t}: n/a (${String(e.message).split("\n")[0]})`);
  }
}

await prisma.$disconnect();
