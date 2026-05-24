"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * ADIA — Asistente de JURMAQ Barraca (rule-based + Gemini Flash backend).
 *
 * ADIA = Asistente Digital de Información y Asesoría.
 *
 * Quick actions arriba (rule-based, latencia 0, sin costo): buscar, calculadora,
 * cotizar, WhatsApp. Eso resuelve 80% de las consultas.
 *
 * Input libre abajo conectado a /api/asistente/chat (Gemini Flash con tools).
 * Cuando GEMINI_API_KEY no está configurada, retorna respuesta canned con
 * link a WhatsApp.
 *
 * Posicionamiento (fix Z-AXIS contra WhatsApp FAB): bottom-24 right-6
 * (la WhatsApp FAB en BarracaShell vive en bottom-6 right-6, gap de 72px).
 *
 * Privacy (Ley 21.719): mensajes no se persisten más de la sesión del browser.
 * Solo logs server-side enmascarados.
 */

interface QuickAction {
  label: string;
  // Mantenemos el campo `emoji` por compatibilidad pero ahora es un nodo SVG.
  icon: React.ReactNode;
  href: string;
}

// SVG primitives (skill design-taste: emojis baneados en UI estructural)
const ic = "w-4 h-4 shrink-0";
const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Buscar productos",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    ),
    href: "/buscar",
  },
  {
    label: "Calculadora hormigón",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h8M8 16h5" /></svg>
    ),
    href: "/calculadora-hormigon",
  },
  {
    label: "Calculadora fierro",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M8 6v12M16 6v12" /></svg>
    ),
    href: "/calculadora-fierro",
  },
  {
    label: "Pedir cotización",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
    ),
    href: "/cotizar",
  },
  {
    label: "Hablar por WhatsApp",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
    ),
    href: "https://wa.me/56976673577",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function AsistenteWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll a último mensaje
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Cargar consent del localStorage (Ley 21.719)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setConsentGiven(localStorage.getItem("asistente_consent") === "true");
  }, []);

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
      const res = await fetch("/api/asistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error en el servidor");
      } else {
        setMessages([
          ...newHistory,
          { role: "assistant", content: data.reply, timestamp: Date.now() },
        ]);
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
        className={`fixed bottom-24 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-transform duration-200 ${
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
        <div className="fixed bottom-40 right-6 z-50 w-[90vw] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#EAEAEA]">
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
            <div className="flex-1 p-6 overflow-y-auto">
              <h3 className="font-bold mb-2 text-navy-950">Antes de empezar</h3>
              <p className="text-sm text-gray-600 mb-4">
                Este asistente usa IA para ayudarte. Tus mensajes <strong>no se guardan</strong>{" "}
                más allá de esta sesión, y nunca compartimos información personal.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                ⚠️ Para <strong>precios y stock reales</strong>, las respuestas de la IA pueden
                no ser exactas. Confirmá siempre por WhatsApp antes de tomar decisiones.
              </p>
              <button
                type="button"
                onClick={acceptConsent}
                className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600"
              >
                Entiendo, empezar
              </button>
            </div>
          ) : (
            <>
              {/* Quick actions */}
              {messages.length === 0 && (
                <div className="px-4 py-4 bg-[#F7F6F3] border-b border-[#EAEAEA]">
                  <p className="text-[10px] font-semibold text-[#787774] mb-3 uppercase tracking-[0.18em]">
                    Acciones rápidas
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        target={a.href.startsWith("http") ? "_blank" : undefined}
                        rel={a.href.startsWith("http") ? "noopener noreferrer nofollow" : undefined}
                        className="bg-white border border-[#EAEAEA] rounded-lg p-2.5 text-xs font-medium text-[#111111] hover:border-navy-950 hover:bg-white transition-colors flex items-center gap-2 active:scale-[0.98]"
                      >
                        <span className="text-[#956400]">{a.icon}</span>
                        <span className="truncate">{a.label}</span>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-[#787774] mt-3 text-center font-[var(--font-serif)] italic">
                    o escribí tu consulta a ADIA abajo
                  </p>
                </div>
              )}

              {/* Conversation */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((m, i) => (
                  <div
                    key={i}
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
