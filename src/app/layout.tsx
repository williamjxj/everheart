import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Everheart — AI Companions You Own Forever",
  description:
    "Create or buy AI companions with chat, portrait, voice and long-term memory. One-time payment. Adult content optional behind 18+ verification.",
  applicationName: "Everheart",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Everheart",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-zinc-100">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
