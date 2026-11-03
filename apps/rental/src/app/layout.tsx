import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Geist, Oswald } from 'next/font/google';
import { SITIO } from '@/lib/sitio';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap', weight: ['500', '600'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  title: { default: 'Arriendo de Maquinaria en el Maule · JURMAQ', template: '%s' },
  description:
    'Arriendo de retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y alzahombre en Curicó, Molina, Talca y toda la Región del Maule.',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#fbfbfa', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return (
    <html lang="es-CL" className={`${geist.variable} ${oswald.variable}`}>
      <body>
        {children}
        {ga ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="lazyOnload" />
            <Script id="ga" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
