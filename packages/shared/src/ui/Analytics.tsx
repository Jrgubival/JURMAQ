import Script from "next/script";
import { env } from "@jurmaq/shared/env";

/**
 * Analytics + Google Consent Mode v2 — versión compartida entre barraca y constructora.
 *
 * Por qué importa:
 * - Google Analytics 4 + Ads requieren consentimiento explícito para uso de
 *   cookies analíticas/marketing en Chile (Ley 21.719 indirectamente, pero
 *   sobre todo política de Google) → Consent Mode v2 (granted/denied).
 * - Sin Consent Mode v2, GA4 puede no registrar eventos en regiones EEA y
 *   pierde conversiones en remarketing.
 *
 * Cómo funciona:
 * - Setea consent default DENIED para todas las categorías ANTES de cargar
 *   gtag.js. Necesario para cumplir política Google + Ley 21.719.
 * - {@link CookieBanner} llama `gtag('consent', 'update', {...})` cuando el
 *   user acepta o rechaza. Sin banner, todo queda denied (modo conservador).
 *
 * Configuración:
 * - Si `NEXT_PUBLIC_GA_MEASUREMENT_ID` no está seteado, retorna null — ideal
 *   para previews y dev.
 *
 * CSP:
 * - El layout host debe permitir `https://www.googletagmanager.com` y
 *   `https://www.google-analytics.com` en `script-src` y `connect-src`
 *   (ver next.config.ts de cada app).
 */
export default function Analytics() {
  const gaId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
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
