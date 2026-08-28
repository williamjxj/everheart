"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker. Enabled in production builds; in dev
 * it can be forced with ?pwa=1 so the PWA can be tested locally.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const force =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("pwa");
    if (process.env.NODE_ENV !== "production" && !force) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
