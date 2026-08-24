"use client";

import { useState } from "react";
import Link from "next/link";

export interface CompanionPreview {
  id: string;
  name: string;
  portraitUrl?: string | null;
  lastMessage?: string;
  isNsfw?: boolean;
}

interface CompanionSidebarProps {
  companions: CompanionPreview[];
  activeId?: string;
}

export function CompanionSidebar({ companions, activeId }: CompanionSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside className="w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <Link href="/" className="text-lg font-bold text-rose-400">
          Everheart
        </Link>
        <p className="text-xs text-zinc-500 mt-1">你的 AI 伴侣</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {companions.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">
            还没有伴侣。
            <Link href="/create" className="text-rose-400 underline ml-1">
              去创建
            </Link>
          </div>
        ) : (
          companions.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition border-l-2 ${
                activeId === c.id
                  ? "border-rose-500 bg-zinc-900/80"
                  : "border-transparent"
              }`}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                {hoveredId === c.id && c.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video
                    src={c.portraitUrl.replace(/\.png$/, ".mp4")}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : c.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.portraitUrl}
                    alt={c.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  c.name.slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{c.name}</span>
                  {c.isNsfw && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded">
                      18+
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {c.lastMessage}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <Link
          href="/create"
          className="block w-full text-center py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-medium transition"
        >
          + 创建新伴侣
        </Link>
      </div>
    </aside>
  );
}
