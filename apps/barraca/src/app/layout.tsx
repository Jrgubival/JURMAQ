import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import BarracaShell from "./BarracaShell";
import Analytics from "@/components/Analytics";
import "./globals.css";

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
    template: "%s | Barraca JURMAQ",
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
    <html lang="es-CL">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {/* P0 audit-analytics fix: Analytics no estaba en el árbol, todo trackEvents.*
            quedaba no-op (0 datos GA4). Esta línea repara el bug. */}
        <Analytics />
        <BarracaShell>{children}</BarracaShell>
      </body>
    </html>
  );
}
