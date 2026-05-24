"use client";

import { useEffect, useState } from "react";

/**
 * CookieBanner — Consent Mode v2 implementation.
 *
 * Por qué importa:
 * - Google Analytics 4 + Ads requieren consentimiento explícito para uso de
 *   cookies analíticas/marketing en Chile (Ley 21.719 indirectamente, pero
 *   sobre todo política de Google) → Consent Mode v2 (granted/denied).
 * - Sin Consent Mode v2, GA4 puede no registrar eventos en regiones EEA y
 *   pierde conversiones en remarketing.
 *
 * Cómo funciona:
 * - Default state se setea ANTES de gtag.js (en Analytics.tsx) con todo denied.
 * - Si el usuario ya consintió antes (localStorage `consent_v2`), se hace
 *   `gtag('consent', 'update', ...)` con granted en mount.
 * - Si NO consintió, renderizamos el banner. Accept → update granted.
 *
 * Privacy:
 * - Solo guardamos `accepted: true|false` y timestamp.
 * - Nada de PII, nada de email, nada que requiera RGPD/Ley21719 strict mode.
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
  // gtag('consent', 'update', {...})
  window.gtag("consent", "update", params);
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (!existing) {
      // No decision yet → show banner.
      setVisible(true);
      return;
    }
    // Already decided. Push the corresponding consent on mount so gtag knows.
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
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-4 inset-x-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-md z-[60]"
    >
      <div className="bg-white border border-[#EAEAEA] rounded-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)] p-5">
        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">
          Privacidad
        </p>
        <h2 className="text-base font-medium text-[#111111] mb-2 tracking-[-0.005em]">
          Usamos cookies para mejorar tu experiencia.
        </h2>
        <p className="text-sm text-[#5A5A57] leading-relaxed mb-4">
          Analytics y marketing nos ayudan a entender qué productos buscás y a
          mostrarte ofertas relevantes. Sin datos personales identificables.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={accept}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-950 text-white text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-[#111111] transition-colors"
          >
            Aceptar todo
          </button>
          <button
            type="button"
            onClick={reject}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#EAEAEA] text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-[#FBFBFA] transition-colors"
          >
            Solo esencial
          </button>
        </div>
      </div>
    </div>
  );
}
