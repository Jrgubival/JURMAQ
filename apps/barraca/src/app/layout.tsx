import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import BarracaShell from "./BarracaShell";
import Analytics from "@/components/Analytics";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

// Skill-driven typography swap (Inter banned by frontend-design, design-taste,
// minimalist-ui, web-typography, redesign-existing-projects, high-end-visual-design).
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#081428",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://barraca.jurmaq.cl"),
  title: {
    default: "Barraca JURMAQ · Fierros y Materiales en Curicó y Molina",
    // Sin template — las páginas ya incluyen la marca en sus title individuales.
    // El template duplicaba "Barraca JURMAQ" en muchas URLs (audit fase 4.8).
    template: "%s",
  },
  description:
    "Fierros, perfiles, planchas, tubos, mallas, pinturas y materiales de construcción con despacho en Curicó, Molina y toda la Región del Maule.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/favicon-32x32.png",
  },
  manifest: "/manifest.json",
};

export default function BarracaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es-CL" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}>
      <body className="min-h-screen bg-[#FBFBFA] text-[#111111] antialiased font-[var(--font-sans)]">
        {/* P0 audit-analytics fix: Analytics no estaba en el árbol, todo trackEvents.*
            quedaba no-op (0 datos GA4). Esta línea repara el bug. */}
        <Analytics />
        <BarracaShell>{children}</BarracaShell>
        <CookieBanner />
      </body>
    </html>
  );
}
