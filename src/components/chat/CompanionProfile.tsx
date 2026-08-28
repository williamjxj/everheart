"use client";

import { useState } from "react";
import type { CompanionData } from "@/lib/demo-companions";

interface CompanionProfileProps {
  companion: CompanionData;
  onClose: () => void;
}

/** Intro card shown at the top of a chat: living portrait + who you're talking to. */
export function CompanionProfile({ companion, onClose }: CompanionProfileProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoUrl = companion.portraitUrl?.replace(/\.png$/, ".mp4");
  const age = companion.card?.everheart?.age;
  const tags: string[] = companion.card?.tags ?? [];
  const intro =
    companion.card?.description ||
    companion.card?.personality ||
    "一位等你来了解的 AI 伴侣。";

  return (
    <div className="relative flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur p-4 mb-4">
      <button
        onClick={onClose}
        aria-label="关闭简介"
        className="absolute top-2 right-3 text-zinc-500 hover:text-zinc-200 transition text-lg leading-none"
      >
        ×
      </button>

      <div className="w-20 h-24 shrink-0 rounded-xl overflow-hidden bg-zinc-800 ring-1 ring-zinc-700">
        {videoUrl ? (
          videoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companion.portraitUrl ?? undefined}
              alt={companion.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={videoUrl}
              aria-label={companion.name}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoFailed(true)}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {companion.name.slice(0, 1)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 pr-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-lg leading-tight">{companion.name}</h2>
          {age != null && (
            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">
              {age}岁
            </span>
          )}
          {companion.isNsfw && (
            <span className="text-[10px] px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded">
              18+
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 bg-rose-500/15 text-rose-200 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-3">
          {intro}
        </p>
      </div>
    </div>
  );
}
