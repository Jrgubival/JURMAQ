"use client";

import Script from "next/script";
import { useConsentimiento } from "@/lib/consentimiento";

/**
 * Google Analytics de la barraca, cargado SÓLO después de "Aceptar" en el
 * aviso de cookies (Política de Privacidad 7.3). Antes se usaba el Analytics
 * compartido, que descarga gtag.js al entrar con el consentimiento denegado:
 * el navegador igual contactaba a Google antes de que la persona eligiera.
 *
 * Mientras no hay script, `window.gtag` no existe y lib/analytics no envía nada.
 */
export default function AnalyticsConConsentimiento() {
  const aceptado = useConsentimiento();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId || !aceptado) return null;

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            analytics_storage: 'granted'
          });
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(gaId)}, { anonymize_ip: true, cookie_flags: 'SameSite=Lax;Secure' });
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
    </>
  );
}
