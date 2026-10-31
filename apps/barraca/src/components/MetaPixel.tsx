"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { esRutaPrivada } from "@/lib/rutas-privadas";
import { env } from "@jurmaq/shared/env";
import { useConsentimiento } from "@/lib/consentimiento";

/**
 * Píxel de Meta (Facebook / Instagram Ads).
 *
 * Apagado si NEXT_PUBLIC_META_PIXEL_ID está vacío (el schema de env sólo acepta
 * dígitos, así que el id se puede insertar en el script sin escaparlo). El script
 * de Meta se descarga SÓLO después de "Aceptar" en el aviso de cookies (Política
 * de Privacidad 7.3): antes se bajaba al entrar con el consentimiento revocado,
 * y eso ya le mostraba la IP del visitante a Meta antes de que eligiera.
 *
 * Eventos: PageView en cada navegación (acá), ViewContent en la ficha
 * (ViewItemTracker), AddToCart, InitiateCheckout y Purchase en
 * lib/analytics.ts.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  const pathname = usePathname();
  const aceptado = useConsentimiento();

  useEffect(() => {
    if (!PIXEL_ID) return;
    const onConsent = (e: Event) => {
      const granted = (e as CustomEvent<{ granted: boolean }>).detail?.granted;
      window.fbq?.("consent", granted ? "grant" : "revoke");
    };
    window.addEventListener("jurmaq:consent", onConsent);
    return () => window.removeEventListener("jurmaq:consent", onConsent);
  }, []);

  // El primer PageView lo manda el script al cargar; acá van las
  // navegaciones siguientes (el sitio es una SPA).
  const primera = useRef(true);
  useEffect(() => {
    if (!PIXEL_ID) return;
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (!esRutaPrivada(pathname)) window.fbq?.("track", "PageView");
  }, [pathname]);

  // Si se entra directo a una página con token, el píxel ni se carga.
  if (!PIXEL_ID || !aceptado || (primera.current && esRutaPrivada(pathname))) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('consent', 'grant');
        fbq('init', '${PIXEL_ID}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
