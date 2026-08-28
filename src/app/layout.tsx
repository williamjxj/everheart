import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everheart — AI Companions You Own Forever",
  description:
    "Create or buy AI companions with chat, portrait, voice and long-term memory. One-time payment. Adult content optional behind 18+ verification.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
