"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePage() {
  const router = useRouter();
  const [archetype, setArchetype] = useState("");
  const [vibe, setVibe] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCard(null);
    setCreatedId(null);

    try {
      const res = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archetype, vibe, nsfw }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");

      const newCard = data.card;
      setCard(newCard);

      // Save into localStorage companions list
      const id = `user-${Date.now()}`;
      const companion = {
        id,
        name: newCard.name,
        card: newCard,
        isNsfw: !!nsfw,
        portraitUrl: null,
      };

      try {
        const raw = localStorage.getItem("everheart_companions");
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(companion);
        localStorage.setItem("everheart_companions", JSON.stringify(list));
      } catch {}

      // Persist the character in Supabase (dynamic chats stay in the browser).
      try {
        await fetch("/api/companions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name: newCard.name,
            card: newCard,
            isNsfw: !!nsfw,
            portraitUrl: null,
          }),
        });
      } catch {}

      setCreatedId(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">创建伴侣</h1>
        <a href="/chat" className="text-sm text-rose-400 hover:underline">
          去聊天 →
        </a>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 mb-10">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">角色设定 / 概念</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2"
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            placeholder="例如：神秘的图书管理员，掌握禁忌知识"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">氛围（可选）</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="温暖但神秘，略带调侃"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nsfw}
            onChange={(e) => setNsfw(e.target.checked)}
          />
          允许成人内容（后续需要 18+ 验证）
        </label>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg font-medium"
        >
          {loading ? "生成中…" : "生成伴侣"}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {card && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold">{card.name}</h2>
          <p className="text-zinc-400 whitespace-pre-wrap">{card.description}</p>
          <div>
            <h3 className="text-sm text-zinc-500 uppercase tracking-wide mb-1">
              开场白
            </h3>
            <p className="italic text-zinc-300">{card.first_mes}</p>
          </div>

          {createdId && (
            <button
              onClick={() => router.push(`/chat/${createdId}`)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-medium"
            >
              立即开始和 {card.name} 聊天
            </button>
          )}

          <pre className="text-xs bg-zinc-950 p-4 rounded overflow-auto max-h-48">
            {JSON.stringify(card, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
