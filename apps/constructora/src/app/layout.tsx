import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import Navbar from "@/components/public/Navbar";
import { buildPrerenderRules, CONSTRUCTORA_PRERENDER_EXCLUDES } from "@jurmaq/shared/seo/prerender-rules";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
    template: "%s | JURMAQ",
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
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "JURMAQ — Arriendo Maquinaria, Constructora y Barraca de Fierros en Curicó",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
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
        {/* Organization + LocalBusiness JSON-LD for Google brand panel */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://jurmaq.cl/#organization",
                  name: "JURMAQ",
                  legalName: "Constructora Jorge Ubilla Rivera E.I.R.L.",
                  url: "https://jurmaq.cl",
                  logo: "https://jurmaq.cl/icon-512.png",
                  image: "https://jurmaq.cl/icon-512.png",
                  email: "contacto@jurmaq.cl",
                  telephone: "+56976673577",
                  description:
                    "Arriendo de maquinaria pesada, constructora, maestranza y barraca de fierros en Curicó y Región del Maule. Súbenos tu cotización y en menos de 2 horas te mejoramos el precio.",
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Av. Poniente 2157",
                    addressLocality: "Molina",
                    addressRegion: "Región del Maule",
                    postalCode: "3550000",
                    addressCountry: "CL",
                  },
                  areaServed: [
                    { "@type": "City", name: "Curicó" },
                    { "@type": "City", name: "Molina" },
                    { "@type": "City", name: "Teno" },
                    { "@type": "City", name: "Romeral" },
                    { "@type": "City", name: "Sagrada Familia" },
                    { "@type": "City", name: "Hualañé" },
                    { "@type": "City", name: "Licantén" },
                    { "@type": "City", name: "Vichuquén" },
                    { "@type": "City", name: "Rauco" },
                    { "@type": "City", name: "Talca" },
                    { "@type": "City", name: "Linares" },
                    { "@type": "AdministrativeArea", name: "Región del Maule" },
                  ],
                  sameAs: ["https://www.instagram.com/jurmaq.cl"],
                },
                {
                  "@type": "LocalBusiness",
                  "@id": "https://jurmaq.cl/#localbusiness",
                  name: "JURMAQ — Arriendo de Maquinaria y Constructora",
                  url: "https://jurmaq.cl",
                  image: "https://jurmaq.cl/icon-512.png",
                  telephone: "+56976673577",
                  priceRange: "$$",
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Av. Poniente 2157",
                    addressLocality: "Molina",
                    addressRegion: "Región del Maule",
                    postalCode: "3550000",
                    addressCountry: "CL",
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: -34.9833,
                    longitude: -71.2333,
                  },
                  openingHoursSpecification: [
                    {
                      "@type": "OpeningHoursSpecification",
                      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                      opens: "08:30",
                      closes: "18:30",
                    },
                    {
                      "@type": "OpeningHoursSpecification",
                      dayOfWeek: "Saturday",
                      opens: "09:00",
                      closes: "14:00",
                    },
                  ],
                  areaServed: { "@type": "AdministrativeArea", name: "Región del Maule, Chile" },
                  parentOrganization: { "@id": "https://jurmaq.cl/#organization" },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://jurmaq.cl/#website",
                  url: "https://jurmaq.cl",
                  name: "JURMAQ",
                  publisher: { "@id": "https://jurmaq.cl/#organization" },
                  inLanguage: "es-CL",
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-[var(--font-inter)]">
        {/* GA4 — solo carga si NEXT_PUBLIC_GA_MEASUREMENT_ID está en env */}
        <Analytics />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
