import { CompanionData, parseCompanionMd, serializeCompanionMd } from "@/lib/cards/md";
import {
  deleteCompanionMd,
  getCompanionMd,
  listCompanions,
  putCompanionMd,
} from "@/lib/companions/store";
import {
  inferGender,
  voiceForCharacter,
} from "@/lib/tts/gender-voice";

const DEMO_IDS = [
  "demo-elena",
  "demo-kai",
  "demo-lyra",
  "demo-mira",
  "demo-dante",
  "demo-yuna",
  "demo-cassian",
  "demo-nova",
  "demo-sienna",
  "demo-raven",
] as const;

/** Bundled demo cards live next to their portrait assets: /companions/<slug>/demo-<slug>.md */
function demoCompanionPath(id: string): string {
  const slug = id.startsWith("demo-") ? id.slice("demo-".length) : id;
  return `/companions/${slug}/${id}.md`;
}

export const DEMO_COMPANION_FILES = DEMO_IDS.map(demoCompanionPath);

export function getBundledDemoCompanionIds(): string[] {
  return [...DEMO_IDS];
}

async function fetchBundledCompanion(id: string): Promise<CompanionData | null> {
  try {
    const res = await fetch(demoCompanionPath(id));
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
      const data = parseCompanionMd(entry.md);
      // Repair older user-created companions whose portrait was generated
      // before the URL was persisted into their md (the file still exists at
      // /companions/<id>/portrait.png).
      if (
        !data.portraitUrl &&
        data.id.startsWith("user-") &&
        typeof window !== "undefined"
      ) {
        const candidate = `/companions/${data.id}/portrait.png`;
        try {
          const res = await fetch(candidate, { method: "HEAD" });
          if (res.ok) data.portraitUrl = candidate;
        } catch {
          /* portrait optional */
        }
      }
      // Same repair for voice: user-created companions saved before the
      // gender-aware picker existed have no voice and would default to a
      // female TTS. Derive one from the card so the voice matches the
      // character, then let the chat page use it.
      if (!data.voice) {
        data.voice = voiceForCharacter(
          data.name,
          data.card.everheart?.gender ??
            inferGender(
              `${data.card.description ?? ""} ${data.card.personality ?? ""} ${data.card.system_prompt ?? ""}`
            )
        );
      }
      out.push(data);
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
