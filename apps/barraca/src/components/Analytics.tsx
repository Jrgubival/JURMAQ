import Script from "next/script";

/**
 * Componente que monta gtag (GA4) si NEXT_PUBLIC_GA_MEASUREMENT_ID está
 * configurado. Sin la env var, NO hace nada (no carga script, no conecta
 * a Google) — ideal para previews y dev.
 *
 * Uso: importar en `src/app/layout.tsx` justo antes de `<body>` o en
 * `<head>` para montar gtag.js. Los events se disparan desde
 * `src/lib/analytics.ts` (track / trackEvents).
 *
 * CSP: el root layout ya permite `https://www.googletagmanager.com` en
 * `script-src` y `connect-src` (ver next.config.ts).
 */
export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            anonymize_ip: true,
            cookie_flags: 'SameSite=Lax;Secure'
          });
        `}
      </Script>
    </>
  );
}
