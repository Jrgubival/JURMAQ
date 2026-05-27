import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Bebas_Neue } from "next/font/google";
import "./globals.css";
import Analytics from "@jurmaq/shared/ui/Analytics";
import CookieBanner from "@jurmaq/shared/ui/CookieBanner";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { buildPrerenderRules, CONSTRUCTORA_PRERENDER_EXCLUDES } from "@jurmaq/shared/seo/prerender-rules";
import { buildJsonLdGraph } from "@jurmaq/shared/seo/jsonld";
// Side-effect import: valida env vars al startup. Si falta una required en
// prod, Zod tira un error explícito en lugar de propagar `undefined`.
import "@jurmaq/shared/env";

// Skill-driven typography (frontend-design + design-taste + minimalist-ui + web-typography):
// - Inter banned across all design skills → replaced with Geist (sans body/UI)
// - Editorial hero serif → Newsreader (recommended by minimalist-ui)
// - Industrial brand accent → Bebas Neue (sans-serif condensada bold uppercase,
//   match exacto con la tipografía que JURMAQ usa en sus posters de marketing
//   "NUESTRA FLOTA COMPLETA · JURMAQ ARRIENDO", "LA RETRO EN ACCIÓN", etc.
//   El owner pidió matching tipográfico con sus máquinas/marketing. Bebas Neue
//   es la fuente de referencia para letreros industriales y advertising de
//   construcción / maquinaria pesada).
// - Tabular numbers / code → Geist Mono
// Variable fonts only, font-display: swap, latin subset only for payload.
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

const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"], // Bebas Neue only ships in a single weight
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit=cover lets the page paint into the iOS notch / dynamic-island
  // area instead of leaving a white strip there.
  viewportFit: "cover",
  themeColor: "#0c1d3a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://jurmaq.cl"),
  title: {
    default:
      "JURMAQ · Arriendo Maquinaria, Constructora y Barraca de Fierros en Curicó",
    // Las páginas internas ya incluyen "JURMAQ" en su title individual; el
    // template "%s | JURMAQ" causaba duplicación (ej. "...JURMAQ | JURMAQ").
    template: "%s",
  },
  description:
    "Arriendo retroexcavadora, miniexcavadora, minicargador y maquinaria pesada en Curicó, Teno, Molina, Talca y toda la Región del Maule. Constructora, maestranza y barraca de fierros JURMAQ. +25 años. Súbenos tu cotización: en menos de 2 horas te mejoramos el precio.",
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
  keywords: [
    // Constructora
    "constructora Curico",
    "constructora Maule",
    "constructora Teno",
    "constructora Molina",
    "constructora Romeral",
    "constructora Talca",
    "constructora Linares",
    "empresa constructora Region del Maule",
    "construccion industrial Curico",
    "construccion industrial Maule",
    // Arriendo maquinaria
    "arriendo maquinaria Curico",
    "arriendo maquinaria Maule",
    "arriendo maquinaria Talca",
    "arriendo maquinaria Teno",
    "arriendo maquinaria Molina",
    "arriendo maquinaria Rancagua",
    "arriendo retroexcavadora Curico",
    "arriendo retroexcavadora Maule",
    "arriendo miniexcavadora Curico",
    "arriendo minicargador Curico",
    "arriendo brazo articulado Curico",
    "arriendo plataforma elevadora Curico",
    "arriendo camion tolva Curico",
    "arriendo alzahombre Curico",
    "maquinaria pesada Curico",
    "maquinaria pesada Maule",
    "maquinaria construccion Chile",
    // Maestranza
    "maestranza Curico",
    "maestranza Molina",
    "maestranza Maule",
    "taller mecanico maquinaria Curico",
    "reparacion maquinaria pesada Maule",
    // Barraca
    "barraca de fierros Curico",
    "barraca fierros Maule",
    "barraca fierros Molina",
    "fierros construccion Curico",
    "materiales de construccion Curico",
    "materiales construccion Maule",
    "ferreteria Curico",
    "ferreteria Molina",
    "perfiles metalicos Curico",
    "planchas acero Curico",
    "tubos metalicos Maule",
    "fierro estriado Curico",
    "malla acma Curico",
    // Servicios
    "movimiento de tierras Curico",
    "fundaciones industriales Maule",
    "montaje estructural Curico",
    // Marca y localidades
    "JURMAQ",
    "JURMAQ Curico",
    "JURMAQ Molina",
    "Romeral",
    "Sagrada Familia",
    "Hualane",
    "Licanten",
    "Vichuquen",
    "Rauco",
    "Talca",
    "Linares",
    "Constitucion",
    "Rancagua",
    "Provincia de Curico",
    "Region del Maule",
  ],
  alternates: {
    canonical: "https://jurmaq.cl",
  },
  manifest: "/manifest.json",
  openGraph: {
    title:
      "JURMAQ · Arriendo Maquinaria, Constructora y Barraca de Fierros en Curicó y Maule",
    description:
      "+25 años en arriendo de maquinaria pesada (retros, miniexcavadoras, minicargadores, brazos articulados), constructora industrial y barraca de fierros con +1.600 productos. Súbenos tu cotización y en menos de 2 horas te mejoramos el precio.",
    url: "https://jurmaq.cl",
    siteName: "JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      // Primary OG image — 1200×630 es el aspect ratio canonical
      // (Facebook/LinkedIn/WhatsApp). Generado por scripts/og/generate-og-images.mjs.
      {
        url: "/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: "JURMAQ — Arriendo Maquinaria, Constructora y Barraca de Fierros en Curicó",
      },
      // Segundo intento por si algún crawler exótico prefiere square.
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "JURMAQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "JURMAQ · Arriendo Maquinaria y Barraca de Fierros en Curicó y Maule",
    description:
      "Arriendo de retros, miniexcavadoras y minicargadores en Curicó, Teno, Molina y Talca. Barraca de fierros con +1.600 productos. Te mejoramos el precio en menos de 2 horas.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "construction",
  other: {
    "geo.region": "CL-ML",
    "geo.placename": "Curico, Maule, Chile",
    "geo.position": "-34.9833;-71.2333",
    ICBM: "-34.9833, -71.2333",
    "DC.title": "JURMAQ - Constructora, Maquinaria y Barraca de Fierros en Curico",
    "DC.creator": "Constructora Jorge Ubilla Rivera E.I.R.L.",
    "DC.language": "es-CL",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} ${bebasNeue.variable} h-full antialiased`}>
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
            paths sensibles (admin, cuenta, carrito, contrato, pagos, API)
            para no disparar side-effects o costos en flujos transaccionales.
            Safari/Firefox ignoran este script (progressive enhancement). */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildPrerenderRules(CONSTRUCTORA_PRERENDER_EXCLUDES)),
          }}
        />
        {/* Organization + LocalBusiness + WebSite JSON-LD — shared helper
            (mismo schema usado por barraca.jurmaq.cl con brand="barraca"). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildJsonLdGraph('constructora')),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-[var(--font-sans)] bg-[#FBFBFA] text-[#111111]">
        {/* GA4 — solo carga si NEXT_PUBLIC_GA_MEASUREMENT_ID está en env */}
        <Analytics />
        <Navbar />
        {children}
        <Footer />
        <CookieBanner productLabel="máquinas" />
      </body>
    </html>
  );
}
