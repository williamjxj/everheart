import matter from "gray-matter";
import { CharacterCard, CharacterCardSchema } from "@/types/character-card";

export interface CompanionVoice {
  en: string;
  zh: string;
  rate?: string;
  local?: { en: string; zh: string };
}

export interface CompanionData {
  id: string;
  name: string;
  card: CharacterCard;
  isNsfw: boolean;
  portraitUrl?: string | null;
  homePortraitUrl?: string | null;
  voice?: CompanionVoice;
}

export const COMPANION_SECTION_KEYS = [
  "personality",
  "description",
  "backstory",
  "scenario",
  "first_mes",
  "mes_example",
  "relationshipDynamic",
  "kinks",
  "limits",
] as const;

type SectionKey = (typeof COMPANION_SECTION_KEYS)[number];

function splitSections(body: string): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  const lines = body.split(/\r?\n/);
  let current: SectionKey | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (current) sections[current] = buf.join("\n").trim();
  };
  for (const line of lines) {
    const m = /^##\s+.+?\s([a-zA-Z_]+)\s*$/.exec(line.trim());
    if (m && (COMPANION_SECTION_KEYS as readonly string[]).includes(m[1])) {
      flush();
      current = m[1] as SectionKey;
      buf.length = 0;
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return t;
}

function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").trim());
}

export function parseCompanionMd(text: string): CompanionData {
  const { data: fm, content } = matter(text);
  const id = String(fm.id ?? "");
  if (!id) throw new Error("companion md: missing frontmatter id");

  const sections = splitSections(content);

  const voiceRaw: any = fm.voice;
  const voice: CompanionVoice | undefined = voiceRaw
    ? {
        en: String(voiceRaw.en ?? ""),
        zh: String(voiceRaw.zh ?? ""),
        rate: voiceRaw.rate != null ? String(voiceRaw.rate) : undefined,
        local: voiceRaw.local
          ? { en: String(voiceRaw.local.en ?? ""), zh: String(voiceRaw.local.zh ?? "") }
          : undefined,
      }
    : undefined;

  const backstory = sections.backstory ?? "";
  const description = sections.description ?? "";
  const mergedDescription = [description, backstory].filter(Boolean).join("\n\n").trim();

  const card: CharacterCard = CharacterCardSchema.parse({
    spec: "chara_card_v2",
    spec_version: "2.0",
    name: String(fm.name ?? id),
    description: mergedDescription,
    personality: sections.personality ?? "",
    scenario: sections.scenario ?? "",
    first_mes: sections.first_mes ?? "",
    mes_example: stripFence(sections.mes_example ?? ""),
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    everheart: {
      age: Number(fm.age ?? 18),
      isNsfw: fm.isNsfw === true,
      kinks: parseList(sections.kinks ?? ""),
      limits: parseList(sections.limits ?? ""),
      relationshipDynamic: sections.relationshipDynamic ?? undefined,
    },
  });

  return {
    id,
    name: card.name,
    card,
    isNsfw: card.everheart?.isNsfw ?? false,
    portraitUrl: fm.portraitUrl != null ? String(fm.portraitUrl) : null,
    homePortraitUrl: fm.alternateUrl != null ? String(fm.alternateUrl) : null,
    voice: voice && voice.en ? voice : undefined,
  };
}

const SECTION_PRESENTATION: [SectionKey, string][] = [
  ["personality", "性格"],
  ["description", "简介"],
  ["backstory", "背景"],
  ["scenario", "场景"],
  ["first_mes", "开场白"],
  ["mes_example", "对话范例"],
  ["relationshipDynamic", "关系动态"],
  ["kinks", "癖好"],
  ["limits", "界限"],
];

function yamlValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(", ")}]`;
  if (typeof v === "number") return String(v);
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

export function serializeCompanionMd(data: CompanionData): string {
  const ec = data.card.everheart;
  const frontmatter: Record<string, unknown> = {
    id: data.id,
    name: data.name,
    age: ec?.age ?? 18,
    isNsfw: ec?.isNsfw ?? data.isNsfw,
  };
  if (data.card.tags?.length) frontmatter.tags = data.card.tags;
  if (data.voice) {
    frontmatter.voice = {
      en: data.voice.en,
      zh: data.voice.zh,
      ...(data.voice.rate ? { rate: data.voice.rate } : {}),
      ...(data.voice.local ? { local: data.voice.local } : {}),
    };
  }
  if (data.portraitUrl) frontmatter.portraitUrl = data.portraitUrl;
  if (data.homePortraitUrl) frontmatter.alternateUrl = data.homePortraitUrl;

  const fmYaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join("\n");

  const body: string[] = [`# ${data.name}`];
  const content: Record<SectionKey, string> = {
    personality: data.card.personality ?? "",
    description: data.card.description ?? "",
    backstory: "",
    scenario: data.card.scenario ?? "",
    first_mes: data.card.first_mes ?? "",
    mes_example: data.card.mes_example ?? "",
    relationshipDynamic: ec?.relationshipDynamic ?? "",
    kinks: ec?.kinks?.length ? ec.kinks.map((k) => `- ${k}`).join("\n") : "",
    limits: ec?.limits?.length ? ec.limits.map((l) => `- ${l}`).join("\n") : "",
  };

  for (const [key, zh] of SECTION_PRESENTATION) {
    const value = content[key];
    if (!value.trim()) continue;
    if (key === "mes_example") {
      body.push(`## ${zh} ${key}`, "```", value, "```", "");
    } else {
      body.push(`## ${zh} ${key}`, value, "");
    }
  }

  return `---\n${fmYaml}\n---\n\n${body.join("\n").trim()}\n`;
}