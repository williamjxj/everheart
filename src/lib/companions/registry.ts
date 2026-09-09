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