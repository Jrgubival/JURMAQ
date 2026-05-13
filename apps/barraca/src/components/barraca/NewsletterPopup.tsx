"use client";

/**
 * NewsletterPopup — modal de captura de email tras tiempo en página.
 *
 * Mounted via dynamic() en src/app/barraca/layout.tsx con ssr:false.
 * AST no captura dynamic imports — por eso aparece como satélite en
 * graphify aunque esté vivo en producción.
 */

import { useState, useEffect } from "react";

export default function NewsletterPopup() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dismissed = localStorage.getItem("barraca_newsletter_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) return;
    }

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      setShow(true);
    };

    // Trigger after 5 seconds
    const timer = setTimeout(trigger, 5000);

    // Or trigger at 50% scroll (whichever comes first)
    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent >= 0.5) {
        trigger();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function handleClose() {
    setShow(false);
    localStorage.setItem(
      "barraca_newsletter_dismissed",
      Date.now().toString()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!consent) {
      setError("Marca el casillero de consentimiento para recibir el cupón.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/barraca/suscriptores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSuccess(true);
        localStorage.setItem(
          "barraca_newsletter_dismissed",
          Date.now().toString()
        );
        setTimeout(() => setShow(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Error al suscribirse");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-24 right-4 sm:bottom-20 sm:right-24 z-[90] max-w-xs w-[calc(100vw-2rem)] sm:w-full animate-slide-in-right" data-popup-variant="A" data-popup-trigger="newsletter-discount">
      {/* Corner popup - small and non-aggressive */}
      <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 p-5">
        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Cerrar popup de suscripción"
          className="absolute top-3 right-3 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {success ? (
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-navy-950">
              ¡Listo! Revisa tu email para tu código de 10% de descuento.
            </p>
          </div>
        ) : (
          <>
            <div className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded mb-1.5">
              10% OFF en tu primera compra
            </div>
            <h3 className="text-sm font-bold text-navy-950 mb-1 pr-6">
              Suscríbete y recibe tu descuento
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Además te avisamos de ofertas exclusivas. Sin spam.
            </p>

            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  aria-label="Email para suscripción a ofertas"
                  className="flex-1 h-11 min-h-[44px] px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <button
                  type="submit"
                  disabled={loading || !consent}
                  className="h-11 min-h-[44px] px-5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0 touch-manipulation"
                >
                  {loading ? "..." : "OK"}
                </button>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-gray-600 leading-snug">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  aria-label="Acepto recibir promociones por email"
                />
                <span>
                  Acepto recibir promociones por email y la{" "}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline">
                    Política de Privacidad
                  </a>
                  . Puedo darme de baja desde el pie de cada email.
                </span>
              </label>
            </form>
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
