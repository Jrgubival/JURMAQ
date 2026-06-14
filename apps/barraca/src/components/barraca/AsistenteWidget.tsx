"use client";

import { useState, useEffect, useRef } from "react";

/**
 * ADIA — Asistente de JURMAQ Barraca (Groq llama-3.1-8b-instant backend).
 *
 * ADIA = Asistente Digital de Información y Asesoría.
 *
 * UI: chat libre (sin quick actions — preference del owner para UX minimalista).
 * Backend: /api/asistente/chat usa Groq con tool calling (buscar_producto,
 * agregar_al_carrito, calcular_cemento, calcular_fierro, derivar_humano).
 *
 * Posicionamiento: bottom-6 right-6 (esquina opuesta a la WhatsApp FAB que
 * ahora vive en bottom-6 left-6). ADIA es el CTA primario de JURMAQ (navy),
 * WhatsApp es secundario y más pequeño.
 *
 * Privacy (Ley 21.719): mensajes no se persisten más de la sesión del browser.
 * Solo logs server-side enmascarados.
 */

import CartAddedCard, { type CartAddedUi } from "@/components/barraca/CartAddedCard";

type ChatMessageUi = CartAddedUi; // discriminated union para futuros tipos

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** UI rich payload (ej. cart_added) emitido por ADIA tools */
  ui?: ChatMessageUi;
}

/** Lee sessionId del carrito barraca desde localStorage. Mismo mecanismo que
 *  ProductCard / PromotedProductCard usan para POST a /api/carrito. */
function getCartSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("barraca_session") ?? null;
  } catch {
    return null;
  }
}

export default function AsistenteWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  // Auto-scroll a último mensaje
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Cargar consent del localStorage (Ley 21.719)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setConsentGiven(localStorage.getItem("asistente_consent") === "true");
  }, []);

  // Persistencia de la conversación: el widget se re-monta al navegar entre
  // páginas, así que sin esto el chat se borraba. sessionStorage sobrevive la
  // navegación dentro de la pestaña y se limpia al cerrarla.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("adia_chat");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {
      /* no-op */
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    // No guardar antes de hidratar ni pisar lo guardado con un array vacío.
    if (typeof window === "undefined" || !hydratedRef.current || messages.length === 0) return;
    try {
      sessionStorage.setItem("adia_chat", JSON.stringify(messages.slice(-30)));
    } catch {
      /* quota / no-op */
    }
  }, [messages]);

  function acceptConsent() {
    setConsentGiven(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("asistente_consent", "true");
    }
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: Date.now() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    try {
      const sid = getCartSessionId();
      const res = await fetch("/api/asistente/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pasar sessionId para que tool_agregar_al_carrito sepa de qué cliente es.
          ...(sid ? { "X-Session-Id": sid } : {}),
        },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error en el servidor");
      } else {
        // Si tool agregó al carrito, ADIA emitió `data.ui = { kind: 'cart_added', ... }`
        // → guardamos en el mensaje y avisamos al navbar para refrescar el badge.
        const ui: ChatMessageUi | undefined =
          data.ui && data.ui.kind === "cart_added" ? (data.ui as CartAddedUi) : undefined;

        setMessages([
          ...newHistory,
          { role: "assistant", content: data.reply, timestamp: Date.now(), ui },
        ]);

        if (ui) {
          try {
            window.dispatchEvent(new Event("cart-updated"));
          } catch { /* no-op */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar ADIA" : "Abrir ADIA — asistente JURMAQ"}
        className={`fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-transform duration-200 ${
          open ? "bg-navy-800 rotate-45 scale-95" : "bg-navy-950 hover:bg-navy-900 hover:scale-[1.03]"
        } text-white ring-1 ring-white/10`}
        style={{ width: '52px', height: '52px' }}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[90vw] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#EAEAEA]">
          <header className="bg-navy-950 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-[var(--font-serif)] italic text-lg leading-none" style={{ fontWeight: 500, letterSpacing: '0.01em' }}>ADIA</p>
              <p className="text-[11px] text-gray-300 mt-1 uppercase tracking-[0.18em]">Asistente JURMAQ</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="text-gray-300 hover:text-white text-xl"
            >
              ×
            </button>
          </header>

          {!consentGiven ? (
            <div className="flex-1 p-6 overflow-y-auto bg-[#FBFBFA]">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.18em] mb-3">
                Antes de empezar
              </p>
              <h3 className="font-[var(--font-serif)] text-2xl leading-tight text-[#111111] mb-4" style={{ fontWeight: 500 }}>
                Conversemos con <em className="italic">cuidado</em>.
              </h3>
              <p className="text-sm text-[#5A5A57] mb-4 leading-relaxed">
                ADIA usa IA para ayudarte. Tus mensajes <strong className="text-[#111111] font-semibold">no se guardan</strong>{" "}
                más allá de esta sesión, y nunca compartimos información personal.
              </p>
              <div className="flex gap-3 mb-6 p-3 bg-white border border-[#EAEAEA] rounded-lg">
                <svg
                  className="w-4 h-4 shrink-0 text-[#956400] mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <p className="text-xs text-[#5A5A57] leading-relaxed">
                  Para <strong className="text-[#111111] font-semibold">precios y stock reales</strong>, las respuestas de la IA pueden
                  no ser exactas. Confirmá siempre por WhatsApp antes de tomar decisiones.
                </p>
              </div>
              <button
                type="button"
                onClick={acceptConsent}
                className="w-full bg-navy-950 text-white py-3 rounded-lg text-sm font-medium tracking-[0.02em] hover:bg-[#111111] transition-colors"
              >
                Entiendo, empezar
              </button>
            </div>
          ) : (
            <>
              {/* Conversation — chat libre, sin quick actions
                  (preference del owner: UX minimalista, solo chat). */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((m, i) => (
                  <div key={i}>
                    <div
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.role === "user" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                    {/* Rich UI card si ADIA agregó al carrito */}
                    {m.ui?.kind === "cart_added" && (
                      <div className="flex justify-start mt-2">
                        <CartAddedCard ui={m.ui} />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500">
                      Pensando...
                    </div>
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">
                    {error}
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="border-t bg-white p-3 flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ej: cuánto cemento para 4x5m espesor 8cm"
                  disabled={loading}
                  maxLength={500}
                  className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50 hover:bg-orange-600"
                  aria-label="Enviar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
