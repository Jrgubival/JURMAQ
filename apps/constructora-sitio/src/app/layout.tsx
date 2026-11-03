import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import Cabecera from "@/components/Cabecera";
import Movimiento from "@/components/Movimiento";
import Pie from "@/components/Pie";
import { EMPRESA, SITIO_URL } from "@/data/empresa";
import "@jurmaq/shared/styles/grupo.css";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });
const titular = Oswald({ variable: "--font-titular", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: { default: "Constructora industrial en Curicó y Maule | JURMAQ", template: "%s | JURMAQ" },
  description:
    "Obras civiles, maestranza y montaje industrial para plantas en Curicó, Teno y la Región del Maule. Trabajamos con Nestlé, Miguel Torres y Cementos Biobío.",
  openGraph: {
    siteName: EMPRESA.nombre,
    locale: "es_CL",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Armadura de fundación junto a tres silos" }],
  },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  robots: { index: true, follow: true, googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" data-marca="constructora" className={`${sans.variable} ${mono.variable} ${titular.variable}`}>
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        <Cabecera />
        <main id="contenido">{children}</main>
        <Pie />
        <Movimiento />
        {/* Solo prefetch: el sitio es estático y ayuda a la página siguiente. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ prefetch: [{ where: { href_matches: "/*" }, eagerness: "moderate" }] }),
          }}
        />
      </body>
    </html>
  );
}
