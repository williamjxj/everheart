import type { CompanionMemory } from "@/lib/memory/memory-store";

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

/** Manual memory snapshot — Hermes USER.md style, one Markdown file per export. */
export function serializeMemoryToMd(
  memory: CompanionMemory,
  companionName: string
): string {
  const lines: string[] = [
    `# ${companionName} 的记忆`,
    "",
    `_导出时间: ${fmtDate(memory.updatedAt)} · 对话 ${memory.messageCount} 轮_`,
    "",
  ];

  lines.push("## Facts", "");
  if (memory.userProfile.length === 0) {
    lines.push("_还没有记住你的什么。_", "");
  } else {
    for (const f of memory.userProfile) {
      lines.push(
        `- **${f.text}**  _(重要度 ${Math.round(
          f.importance * 100
        )}%, 最近 ${fmtDate(f.lastUsedAt)})_`
      );
    }
    lines.push("");
  }

  lines.push("## Entities", "");
  if (memory.entities.length === 0) {
    lines.push("_还没有记住任何人物或事物。_", "");
  } else {
    for (const e of memory.entities) {
      lines.push(`- **${e.name}** — ${e.note || "（无备注）"}`);
    }
    lines.push("");
  }

  lines.push("## Episodes", "");
  if (memory.episodes.length === 0) {
    lines.push("_还没有可回想的片段。_", "");
  } else {
    for (const ep of memory.episodes) {
      const kw = ep.keywords.length ? ` _(${ep.keywords.join(", ")})_` : "";
      lines.push(`- ${fmtDate(ep.startAt)} — ${ep.summary}${kw}`);
    }
    lines.push("");
  }

  if (memory.summary) {
    lines.push("## 会话摘要", "", memory.summary, "");
  }

  return lines.join("\n");
}