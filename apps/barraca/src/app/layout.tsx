import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Newsreader, Oswald } from "next/font/google";
import BarracaShell from "./BarracaShell";
import Analytics from "@jurmaq/shared/ui/Analytics";
import CookieBanner from "@jurmaq/shared/ui/CookieBanner";
import { buildJsonLdGraph } from "@jurmaq/shared/seo/jsonld";
import { buildPrerenderRules, BARRACA_PRERENDER_EXCLUDES } from "@jurmaq/shared/seo/prerender-rules";
// Side-effect import: valida env vars al startup. Si falta una required en
// prod, Zod tira un error explícito en lugar de propagar `undefined`.
import "@jurmaq/shared/env";
import "./globals.css";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

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

// Titulares (h1 .editorial-h1) → Oswald condensada industrial, en línea con la
// constructora. Reemplaza al serif para una identidad más de construcción.
const oswald = Oswald({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
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
    default: "Barraca JURMAQ · Fierros y Materiales en Molina · Despacho a Curicó y el Maule",
    // Sin template — las páginas ya incluyen la marca en sus title individuales.
    // El template duplicaba "Barraca JURMAQ" en muchas URLs (audit fase 4.8).
    template: "%s",
  },
  description:
    "Fierros, perfiles, planchas, tubos, mallas, pinturas y materiales de construcción con despacho en Curicó, Molina y toda la Región del Maule.",
  keywords: [
    // Marca + barraca
    "Barraca JURMAQ",
    "barraca de fierros Curicó",
    "barraca de fierros Molina",
    "barraca de fierros Maule",
    "ferretería Curicó",
    "ferretería Molina",
    "materiales construcción Curicó",
    "materiales construcción Maule",
    // Fierros
    "fierro estriado Curicó",
    "fierro estriado precio",
    "fierro estriado 8mm",
    "fierro estriado 10mm",
    "fierro estriado 12mm",
    "fierro estriado 16mm",
    "fierro construcción",
    "malla acma Curicó",
    "malla acma precio",
    "malla electrosoldada",
    // Perfiles y planchas
    "perfil metálico Curicó",
    "perfiles metálicos Maule",
    "tubo cuadrado precio",
    "tubo rectangular precio",
    "ángulo doblado precio",
    "planchas de zinc",
    "planchas zinc acanalado",
    // Otros materiales
    "cemento Polpaico precio",
    "cemento Melón precio",
    "pinturas Curicó",
    "Sherwin Williams precio",
    // Servicios
    "despacho materiales Curicó",
    "despacho fierros Maule",
    "comprar materiales construcción Maule",
    // Localidades
    "Curicó",
    "Molina",
    "Teno",
    "Romeral",
    "Sagrada Familia",
    "Hualañé",
    "Licantén",
    "Vichuquén",
    "Rauco",
    "Talca",
    "Linares",
    "Región del Maule",
    "Provincia de Curicó",
  ],
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
  openGraph: {
    title: "Barraca JURMAQ · Fierros y Materiales en Molina · Despacho a Curicó y el Maule",
    description:
      "Fierros, perfiles, planchas, tubos, mallas, pinturas y materiales de construcción con despacho en Curicó, Molina y toda la Región del Maule.",
    url: "https://barraca.jurmaq.cl",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      // Primary OG image 1200×630 — generado por scripts/og/generate-og-images.mjs.
      {
        url: "/og-image-barraca-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Barraca JURMAQ — Fierros y Materiales en Curicó",
      },
      // Segundo intento por si algún crawler exótico prefiere square.
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Barraca JURMAQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barraca JURMAQ · Fierros y Materiales en Curicó",
    description:
      "Fierros, perfiles, planchas, tubos, mallas y pinturas con despacho en Curicó, Molina y toda la Región del Maule.",
  },
  // Search-engine ownership verification (Google Search Console + Bing Webmaster).
  // Tokens vienen de env (no hardcodear). Si ambas vars están vacías, el field
  // se omite por completo para no inyectar <meta> con content="". Ver
  // docs/auditorias/seo-gsc-bing-setup.md para el setup.
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION || process.env.NEXT_PUBLIC_BING_VERIFICATION
    ? {
        verification: {
          ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
            ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
            : {}),
          ...(process.env.NEXT_PUBLIC_BING_VERIFICATION
            ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION } }
            : {}),
        },
      }
    : {}),
};

export default function BarracaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es-CL" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} ${oswald.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconnect to external origins for performance */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://wmoizhbdalvnveclenvf.supabase.co" />
        <link rel="dns-prefetch" href="https://wmoizhbdalvnveclenvf.supabase.co" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        {/* Speculation Rules — Chromium prerender hover-baseado.
            Colapsa LCP percibido a ~0ms en navegaciones probables. Excluye
            paths sensibles (admin, cuenta, carrito, cotizar, pago, API)
            para no disparar side-effects o costos en flujos transaccionales.
            Safari/Firefox ignoran este script (progressive enhancement). */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(buildPrerenderRules(BARRACA_PRERENDER_EXCLUDES)),
          }}
        />
        {/* Organization + LocalBusiness (HardwareStore) + WebSite JSON-LD
            via helper compartido — mismo schema que jurmaq.cl con brand="barraca". */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(buildJsonLdGraph('barraca')),
          }}
        />
      </head>
      <body className="min-h-screen bg-[#FBFBFA] text-[#111111] antialiased font-[var(--font-sans)]">
        {/* P0 audit-analytics fix: Analytics no estaba en el árbol, todo trackEvents.*
            quedaba no-op (0 datos GA4). Esta línea repara el bug. */}
        <Analytics />
        <BarracaShell>{children}</BarracaShell>
        <CookieBanner productLabel="productos" />
      </body>
    </html>
  );
}
