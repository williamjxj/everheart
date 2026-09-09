"use client";

import type { CompanionMemory } from "@/lib/memory/memory-store";
import { serializeMemoryToMd } from "@/lib/memory/export";

interface Props {
  memory: CompanionMemory;
  companionName: string;
  companionId: string;
}

export default function MemoryExportButton({
  memory,
  companionName,
  companionId,
}: Props) {
  function handleExport() {
    try {
      const md = serializeMemoryToMd(memory, companionName);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companionId}.memory.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[memory-export] failed", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-rose-500/60 text-zinc-300 hover:text-zinc-100 transition"
      title="导出记忆为 Markdown (USER.md 快照)"
    >
      ⬇ 导出
    </button>
  );
}