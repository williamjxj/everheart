"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /chat → redirect to first demo companion
 */
export default function ChatIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/chat/demo-elena");
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <p className="text-zinc-500">正在进入聊天…</p>
    </div>
  );
}
