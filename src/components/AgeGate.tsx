"use client";

import { useState } from "react";

/**
 * 18+ gate for NSFW companions. This preview stores a localStorage flag; the
 * production build must replace it with real identity verification
 * (Veriff / Stripe Identity) enforced server-side.
 */
export default function AgeGate({
  onVerified,
}: {
  onVerified: () => void;
}) {
  const [denied, setDenied] = useState(false);

  const confirm = () => {
    try {
      localStorage.setItem("eh-age-ok", "1");
    } catch {}
    onVerified();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-lg font-bold text-white">
          18+
        </div>
        <h2 className="text-2xl font-semibold text-zinc-100">年龄验证</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Everheart 提供可选的成人内容。正式版会在完成身份验证后解锁成人功能；
          当前预览版为安全展示版本。
        </p>
        {denied && (
          <p className="mt-4 text-sm font-medium text-rose-400">
            Everheart 要求用户年满 18 周岁。
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={confirm}
            className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            我已年满 18 周岁
          </button>
          <button
            onClick={() => setDenied(true)}
            className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500"
          >
            我未满 18 岁
          </button>
        </div>
      </div>
    </div>
  );
}
