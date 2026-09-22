-- Everheart memory P1 — server-side persistence.
--
-- Why a hand-written file instead of `prisma db push`: push introspects the
-- database first, and this Supabase project also holds another project's
-- tables with a cross-schema FK (`public.dr_users` → `auth.users`), which makes
-- introspection fail with P4002. Apply with:
--
--   npx prisma db execute --file prisma/sql/2026-09-21-memory-p1.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- Pre-flight (verified 2026-09-21 via scripts/db-inspect.mjs):
--   eh_message 0 rows · eh_memory_fact 0 rows · eh_summary 0 rows
-- so the NOT NULL backfills below cannot lose data.

BEGIN;

-- ---------------------------------------------------------------- eh_memory_fact
ALTER TABLE "eh_memory_fact" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "eh_memory_fact" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'fact';
-- Unused SQLite-era stand-in for pgvector; no rows reference it.
ALTER TABLE "eh_memory_fact" DROP COLUMN IF EXISTS "embedding";

DELETE FROM "eh_memory_fact" WHERE "userId" IS NULL;
ALTER TABLE "eh_memory_fact" ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "eh_memory_fact_userId_companionId_idx"
  ON "eh_memory_fact" ("userId", "companionId");

DO $$
BEGIN
  ALTER TABLE "eh_memory_fact"
    ADD CONSTRAINT "eh_memory_fact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "eh_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------- eh_summary
-- Becomes the per-(user, companion) memory header: it also carries the
-- counters that exist before the first summary is ever produced.
ALTER TABLE "eh_summary" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "eh_summary" ADD COLUMN IF NOT EXISTS "lastSummaryAt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "eh_summary" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "eh_summary" ALTER COLUMN "content" SET DEFAULT '';
ALTER TABLE "eh_summary" ALTER COLUMN "messageCount" SET DEFAULT 0;

DELETE FROM "eh_summary" WHERE "userId" IS NULL;
ALTER TABLE "eh_summary" ALTER COLUMN "userId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "eh_summary"
    ADD CONSTRAINT "eh_summary_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "eh_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- one summary per (user, companion), instead of one per companion
ALTER TABLE "eh_summary" DROP CONSTRAINT IF EXISTS "eh_summary_companionId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "eh_summary_userId_companionId_key"
  ON "eh_summary" ("userId", "companionId");

-- ------------------------------------------------------------ eh_memory_entity
CREATE TABLE IF NOT EXISTS "eh_memory_entity" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "companionId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "note"        TEXT NOT NULL DEFAULT '',
  "importance"  DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eh_memory_entity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eh_memory_entity_userId_companionId_idx"
  ON "eh_memory_entity" ("userId", "companionId");

DO $$
BEGIN
  ALTER TABLE "eh_memory_entity"
    ADD CONSTRAINT "eh_memory_entity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "eh_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "eh_memory_entity"
    ADD CONSTRAINT "eh_memory_entity_companionId_fkey"
    FOREIGN KEY ("companionId") REFERENCES "eh_companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------- eh_memory_episode
CREATE TABLE IF NOT EXISTS "eh_memory_episode" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "companionId" TEXT NOT NULL,
  "summary"     TEXT NOT NULL,
  "keywords"    TEXT NOT NULL DEFAULT '',
  "importance"  DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "startAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eh_memory_episode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eh_memory_episode_userId_companionId_idx"
  ON "eh_memory_episode" ("userId", "companionId");

DO $$
BEGIN
  ALTER TABLE "eh_memory_episode"
    ADD CONSTRAINT "eh_memory_episode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "eh_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "eh_memory_episode"
    ADD CONSTRAINT "eh_memory_episode_companionId_fkey"
    FOREIGN KEY ("companionId") REFERENCES "eh_companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------- eh_message
CREATE INDEX IF NOT EXISTS "eh_message_userId_companionId_createdAt_idx"
  ON "eh_message" ("userId", "companionId", "createdAt");

COMMIT;
