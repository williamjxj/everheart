"use client";

import type { CompanionMemory } from "@/lib/memory/memory-store";
import MemoryExportButton from "@/components/chat/MemoryExportButton";

interface MemoryPanelProps {
  memory: CompanionMemory;
  companionName: string;
  companionId: string;
  onClear: () => void;
}

/** Collapsible view of what the companion remembers (facts, entities, episodes). */
export function MemoryPanel({
  memory,
  companionName,
  companionId,
  onClear,
}: MemoryPanelProps) {
  const empty =
    memory.userProfile.length === 0 &&
    memory.entities.length === 0 &&
    memory.episodes.length === 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🧠 记忆</h3>
        <div className="flex items-center gap-2">
          <MemoryExportButton
            memory={memory}
            companionName={companionName}
            companionId={companionId}
          />
          <button
            onClick={onClear}
            className="text-xs text-zinc-500 hover:text-rose-300 transition"
          >
            清空记忆
          </button>
        </div>
      </div>

      {empty ? (
        <p className="text-xs text-zinc-500">
          还没有记忆 — 多聊几句，我会记住关于你的事。
        </p>
      ) : (
        <>
          {memory.userProfile.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">
                关于你
              </p>
              <ul className="space-y-1">
                {memory.userProfile.slice(0, 8).map((f, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex gap-1.5">
                    <span className="text-rose-400">•</span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
              {memory.userProfile.length > 8 && (
                <p className="text-[11px] text-zinc-600 mt-1">
                  还有 {memory.userProfile.length - 8} 条…
                </p>
              )}
            </div>
          )}

          {memory.entities.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">
                人物 / 事物
              </p>
              <div className="flex flex-wrap gap-1.5">
                {memory.entities.slice(0, 8).map((e) => (
                  <span
                    key={e.name}
                    className="text-[11px] px-2 py-0.5 bg-rose-500/10 text-rose-200 rounded-full"
                  >
                    {e.name} · {e.note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {memory.episodes.length > 0 && (
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">
                回忆片段
              </p>
              <ul className="space-y-1">
                {memory.episodes.slice(0, 2).map((e, i) => (
                  <li
                    key={i}
                    className="text-xs text-zinc-400 line-clamp-2"
                  >
                    • {e.summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
