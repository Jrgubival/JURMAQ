"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * AsistenteWidget v2 — híbrido rule-based + Gemini Flash.
 *
 * Quick actions arriba (rule-based, latencia 0, sin costo): buscar, calculadora,
 * cotizar, WhatsApp. Eso resuelve 80% de las consultas.
 *
 * Input libre abajo conectado a /api/asistente/chat (Gemini Flash con tools).
 * Cuando GEMINI_API_KEY no está configurada, retorna respuesta canned con
 * link a WhatsApp.
 *
 * Privacy (Ley 21.719): mensajes no se persisten más de la sesión del browser.
 * Solo logs server-side enmascarados.
 */

interface QuickAction {
  label: string;
  emoji: string;
  href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Buscar productos", emoji: "🔍", href: "/buscar" },
  { label: "Calculadora hormigón", emoji: "🧱", href: "/calculadora-hormigon" },
  { label: "Calculadora fierro", emoji: "🔩", href: "/calculadora-fierro" },
  { label: "Pedir cotización", emoji: "📋", href: "/cotizar" },
  { label: "Hablar con humano", emoji: "💬", href: "https://wa.me/56912345678" },
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
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        className={`fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform ${
          open ? "bg-gray-700 rotate-45" : "bg-orange-500 hover:bg-orange-600"
        } text-white`}
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
        <div className="fixed bottom-36 right-4 z-50 w-[90vw] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          <header className="bg-navy-950 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold">Asistente JURMAQ</p>
              <p className="text-xs text-gray-300">Te ayudo a calcular y encontrar materiales</p>
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
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Acciones rápidas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        className="bg-white border border-gray-200 rounded p-2 text-xs font-semibold text-navy-950 hover:border-orange-500 flex items-center gap-1.5"
                      >
                        <span>{a.emoji}</span>
                        <span>{a.label}</span>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    o escribí tu consulta abajo
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
