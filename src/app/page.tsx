export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Everheart</h1>
        <p className="text-zinc-400 text-lg">
          AI companions you own forever — chat, portrait, voice, memory.
          <br />
          One-time price. No subscription. Adult optional (18+ verified).
        </p>
        <div className="flex gap-4 justify-center pt-4 flex-wrap">
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
        <p className="text-sm text-zinc-500 pt-8">
          已内置 3 个演示伴侣（Elena / Kai / Lyra）。配置 DEEPSEEK_API_KEY 后即可流式对话。
        </p>
      </div>
    </main>
  );
}
