"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMO_COMPANIONS } from "@/lib/demo-companions";

export default function HomePage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Everheart</h1>
          <p className="text-zinc-400 text-lg">
            AI companions you own forever — chat, portrait, voice, memory.
            <br />
            One-time price. No subscription. Adult optional (18+ verified).
          </p>
          <div className="flex gap-4 justify-center pt-2 flex-wrap">
            <a
              href="/chat"
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-medium transition"
            >
              开始聊天
            </a>
            <a
              href="/create"
              className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 rounded-lg font-medium transition"
            >
              创建伴侣
            </a>
          </div>
        </div>

        <section className="mt-16">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-semibold">遇见你的伴侣</h2>
            <span className="text-sm text-zinc-500">{DEMO_COMPANIONS.length} 位角色</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {DEMO_COMPANIONS.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden hover:border-rose-500/60 hover:bg-zinc-900 transition"
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
            >
                <div className="relative aspect-[2/3] overflow-hidden bg-zinc-800">
                  {(hoveredId === c.id && (c.homePortraitUrl ?? c.portraitUrl)) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <video
                      src={(c.homePortraitUrl ?? c.portraitUrl)?.replace(/\.png$/, ".mp4")}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (c.homePortraitUrl ?? c.portraitUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.homePortraitUrl ?? c.portraitUrl ?? undefined}
                      alt={c.name}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {c.name.slice(0, 1)}
                    </div>
                  )}

                  {/* Hover overlay: companion introduction */}
                  <div
                    className={`pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-zinc-950/95 via-zinc-950/60 to-zinc-950/10 transition-opacity duration-200 ${
                      hoveredId === c.id ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{c.name}</h3>
                        {c.card?.everheart?.age != null && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800/80 text-zinc-300 rounded">
                            {c.card.everheart.age}岁
                          </span>
                        )}
                        {c.isNsfw && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded">
                            18+
                          </span>
                        )}
                      </div>
                      {c.card?.tags && c.card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.card.tags.slice(0, 3).map((tag: string) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-200 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-zinc-200 mt-2 leading-relaxed line-clamp-3 sm:line-clamp-4">
                        {c.card?.description ?? c.card?.personality ?? "一位等你来了解的 AI 伴侣。"}
                      </p>
                      <p className="text-[11px] text-rose-300 mt-2">点击开始聊天 →</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.isNsfw && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded">
                        18+
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {c.card?.tags?.[0] ?? "AI companion"} · 点击开始聊天
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
