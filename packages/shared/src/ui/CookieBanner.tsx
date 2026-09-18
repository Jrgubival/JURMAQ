"use client";

import { useEffect, useState } from "react";

/**
 * CookieBanner — Consent Mode v2 implementation compartida entre apps.
 *
 * Por qué importa:
 * - Google Analytics 4 + Ads requieren consentimiento explícito para uso de
 *   cookies analíticas/marketing en Chile (Ley 21.719 indirectamente, pero
 *   sobre todo política de Google) → Consent Mode v2 (granted/denied).
 * - Sin Consent Mode v2, GA4 puede no registrar eventos en regiones EEA y
 *   pierde conversiones en remarketing.
 *
 * Cómo funciona:
 * - Default state se setea ANTES de gtag.js (en {@link Analytics}) con todo denied.
 * - Si el usuario ya consintió antes (localStorage `consent_v2`), se hace
 *   `gtag('consent', 'update', ...)` con granted en mount.
 * - Si NO consintió, renderizamos el banner. Accept → update granted.
 *
 * Privacy:
 * - Solo guardamos `accepted: true|false` y timestamp.
 * - Nada de PII, nada de email, nada que requiera RGPD/Ley21719 strict mode.
 *
 * Parámetros:
 * - `productLabel`: palabra a usar en el copy ("productos" para barraca,
 *   "máquinas" para constructora, etc.).
 * - `acceptButtonClassName`: override opcional de la clase del botón "Aceptar
 *   todo" para que cada brand pueda usar su token de color preferido
 *   (default: `bg-navy-950` — funciona en ambas apps que tienen ese token).
 */

type ConsentValue = "granted" | "denied";
type ConsentParams = Record<string, ConsentValue>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const STORAGE_KEY = "consent_v2";

interface ConsentRecord {
  v: 1;
  accepted: boolean;
  ts: number;
}

function getStoredConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setStoredConsent(accepted: boolean) {
  try {
    const rec: ConsentRecord = { v: 1, accepted, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

function pushConsent(value: ConsentValue) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const params: ConsentParams = {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  };
  window.gtag("consent", "update", params);
}

export interface CookieBannerProps {
  /** Palabra para el copy del banner — ej "productos", "máquinas". */
  productLabel?: string;
  /** Override del className para el botón "Aceptar todo" (default `bg-navy-950`). */
  acceptButtonClassName?: string;
}

export default function CookieBanner({
  productLabel = "productos",
  acceptButtonClassName = "bg-navy-950 hover:bg-[#111111]",
}: CookieBannerProps = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (!existing) {
      setVisible(true);
      return;
    }
    pushConsent(existing.accepted ? "granted" : "denied");
  }, []);

  if (!visible) return null;

  const accept = () => {
    pushConsent("granted");
    setStoredConsent(true);
    setVisible(false);
  };

  const reject = () => {
    pushConsent("denied");
    setStoredConsent(false);
    setVisible(false);
  };

  return (
    /* Barra delgada al pie, a todo el ancho, como la usan Sodimac y Easy.
       Antes era una tarjeta blanca de 420px flotando abajo a la izquierda que
       tapaba las primeras tarjetas de producto; el dueño la vio y la rechazó.
       Una barra oscura de una línea no tapa contenido y se cierra de un toque. */
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 inset-x-0 z-[60] bg-navy-950 text-white border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <p className="text-[13px] leading-snug text-white/85 sm:flex-1">
          Usamos cookies para medir qué {productLabel} se buscan y mejorar el sitio. Sin datos personales identificables.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reject}
            className="h-9 px-3.5 text-[13px] font-medium text-white/85 hover:text-white border border-white/25 hover:border-white/50 rounded-md transition-colors duration-150"
          >
            Solo esencial
          </button>
          <button
            type="button"
            onClick={accept}
            className={`h-9 px-4 text-[13px] font-semibold text-white rounded-md transition-colors duration-150 ${acceptButtonClassName}`}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
