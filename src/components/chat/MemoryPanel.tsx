"use client";

import type { CompanionMemory } from "@/lib/memory/memory-store";
import MemoryExportButton from "@/components/chat/MemoryExportButton";

interface MemoryPanelProps {
  memory: CompanionMemory;
  companionName: string;
  companionId: string;
  onClear: () => void;
  /** Forget one fact (server + local). Boundaries are deletable too. */
  onDeleteFact?: (fact: string) => void;
  /** Server-side JSON export endpoint, if the caller knows the player id. */
  exportUrl?: string;
}

/** User-set rules ("Boundary: don't call me ...") — surfaced separately
 *  because they are permanent instructions, not just remembered trivia. */
const BOUNDARY_PREFIX = /^\s*boundary\s*:/i;
const boundaryLabel = (text: string) => text.replace(BOUNDARY_PREFIX, "").trim();

/** Collapsible view of what the companion remembers (facts, entities, episodes). */
export function MemoryPanel({
  memory,
  companionName,
  companionId,
  onClear,
  onDeleteFact,
  exportUrl,
}: MemoryPanelProps) {
  const empty =
    memory.userProfile.length === 0 &&
    memory.entities.length === 0 &&
    memory.episodes.length === 0;

  const boundaries = memory.userProfile.filter((f) => BOUNDARY_PREFIX.test(f.text));
  const plainFacts = memory.userProfile.filter((f) => !BOUNDARY_PREFIX.test(f.text));

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🧠 记忆</h3>
        <div className="flex items-center gap-2">
          {exportUrl && (
            <a
              href={exportUrl}
              className="text-xs text-zinc-500 hover:text-rose-300 transition"
              title="导出为 JSON"
            >
              导出 JSON
            </a>
          )}
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
          {boundaries.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-amber-400/80 uppercase tracking-wide mb-1">
                你设过的边界
              </p>
              <ul className="space-y-1">
                {boundaries.map((f) => (
                  <li
                    key={f.text}
                    className="text-xs text-amber-100 bg-amber-500/10 rounded px-2 py-1 flex items-start gap-1.5"
                  >
                    <span>⛔</span>
                    <span className="flex-1">{boundaryLabel(f.text)}</span>
                    {onDeleteFact && (
                      <button
                        onClick={() => onDeleteFact(f.text)}
                        className="text-amber-300/70 hover:text-amber-100 transition"
                        title="删除这条边界"
                        aria-label="删除这条边界"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plainFacts.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">
                关于你
              </p>
              <ul className="space-y-1">
                {plainFacts.slice(0, 8).map((f) => (
                  <li key={f.text} className="text-xs text-zinc-300 flex items-start gap-1.5">
                    <span className="text-rose-400">•</span>
                    <span className="flex-1">{f.text}</span>
                    {onDeleteFact && (
                      <button
                        onClick={() => onDeleteFact(f.text)}
                        className="text-zinc-600 hover:text-rose-300 transition"
                        title="忘掉这条"
                        aria-label="忘掉这条"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {plainFacts.length > 8 && (
                <p className="text-[11px] text-zinc-600 mt-1">
                  还有 {plainFacts.length - 8} 条…
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
