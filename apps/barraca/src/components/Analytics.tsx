import Script from "next/script";

/**
 * Componente que monta gtag (GA4) si NEXT_PUBLIC_GA_MEASUREMENT_ID está
 * configurado. Sin la env var, NO hace nada (no carga script, no conecta
 * a Google) — ideal para previews y dev.
 *
 * Consent Mode v2 (audit fase 4.6):
 * - Setea consent default DENIED para todas las categorías ANTES de cargar
 *   gtag.js. Necesario para cumplir política Google + Ley 21.719.
 * - CookieBanner.tsx llama gtag('consent', 'update', {...}) cuando el user
 *   acepta o rechaza. Sin banner, todo queda denied (modo más conservador).
 *
 * Uso: importar en `src/app/layout.tsx` justo antes de `<body>` o en
 * `<head>` para montar gtag.js. Los events se disparan desde
 * `src/lib/analytics.ts` (track / trackEvents).
 *
 * CSP: el root layout ya permite `https://www.googletagmanager.com` y
 * `https://www.google-analytics.com` en `script-src` y `connect-src`
 * (ver next.config.ts).
 */
export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          // Consent Mode v2 — default DENIED hasta que el usuario decida.
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
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
