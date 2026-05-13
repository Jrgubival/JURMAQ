"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * AsistenteWidget — chat-like navigation aid, NO IA conversacional.
 *
 * Mounted via dynamic() en src/app/barraca/layout.tsx con ssr:false.
 * AST/graphify no captura dynamic imports — por eso aparece satélite.
 *
 * Por qué rule-based en vez de LLM:
 *  - Negocio quiere "no parezca IA". Un chatbot Claude/GPT con onboarding
 *    "Hola, soy asistente virtual" mata esa premisa.
 *  - El cliente B2B (constructora, contratista) quiere persona real, no bot.
 *  - LLM puede inventar precios o stock — aquí los precios son comerciales,
 *    cualquier hallucination es plata real perdida.
 *  - Costo cero de API, latencia cero, sin servidores extras.
 *
 * Qué hace en su lugar:
 *  - Botones de acción rápida (buscar, calculadora, cotizar, WhatsApp)
 *  - Sugiere queries comunes según la página actual
 *  - Reduce fricción de descubrir herramientas que ya tenemos
 *
 * Si después se suma LLM real, va detrás de este UI sin reemplazarlo:
 *  el botón "preguntar al equipo" se convierte en "preguntar al asistente".
 */

interface QuickAction {
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
}

const ICON_SEARCH = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const ICON_CALC = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m0-2.25h-3M9 18h3.75M3.75 4.5h16.5v15a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-15Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5" />
  </svg>
);
const ICON_QUOTE = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
  </svg>
);
const ICON_PRICE = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z" />
  </svg>
);
const ICON_WA = (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Busca un material",
    description: "Cemento, fierro, perfiles, planchas...",
    href: "/buscar",
    icon: ICON_SEARCH,
  },
  {
    label: "Calcula materiales",
    description: "Fierro, cemento, hormigón, pintura, zincalum",
    href: "/calculadoras",
    icon: ICON_CALC,
  },
  {
    label: "Cotizar mi pedido",
    description: "Te respondemos en menos de 2 horas",
    href: "/cotizar",
    icon: ICON_QUOTE,
  },
  {
    label: "Te mejoramos el precio",
    description: "Sube cotización de Sodimac, Easy o Construmart",
    href: "/te-mejoramos-el-precio",
    icon: ICON_PRICE,
  },
];

const FAQS = [
  { q: "¿Hacen despacho a domicilio?", a: "Sí. Despachamos desde Molina a todo el Maule. Curicó en 30 min, Talca en 1h. Cotiza tu pedido y coordinamos despacho a tu obra." },
  { q: "¿Cuál es el horario de atención?", a: "Lunes a viernes 8:30 a 18:30 hrs. Sábado 9:00 a 13:00 hrs. Por WhatsApp +56 9 7667 3577 te contestamos en horario laboral." },
  { q: "¿Aceptan tarjeta?", a: "Sí, MercadoPago acepta crédito y débito. También transferencia y efectivo. Cuenta empresa con plazo de pago disponible para constructoras." },
  { q: "¿Atienden empresas y constructoras?", a: "Sí. Tenemos cuenta empresa con descuento por volumen, plazo de pago a convenir y un vendedor asignado. Habla con nosotros por WhatsApp para coordinar." },
  { q: "¿Despachan en el día?", a: "Sí, si la cotización se cierra antes de las 14:00 y los materiales están en stock. Confirmamos disponibilidad al cotizar." },
];

const WA_NUMBER = "56976673577";
const WA_DEFAULT = "Hola, vengo del asistente del sitio y tengo una consulta";

export default function AsistenteWidget() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "faq">("menu");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Hidden en flujos donde estorba o sticky CTAs propios
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/contrato/firmar") ||
    pathname.startsWith("/producto/") ||
    pathname.startsWith("/barraca/producto/")
  ) {
    return null;
  }

  return (
    <>
      {/* Botón flotante — bottom-right, sobre WhatsAppFloat */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        aria-expanded={open}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-navy-950 hover:bg-navy-800 text-white shadow-lg shadow-navy-900/30 flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente JURMAQ"
          className="fixed bottom-52 lg:bottom-40 right-5 z-40 w-[calc(100vw-40px)] max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="bg-navy-950 text-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">¿En qué te ayudamos?</p>
                <p className="text-xs text-gray-300">Atajos del sitio · Sin filas, sin esperas</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <button
              onClick={() => { setView("menu"); setActiveFaq(null); }}
              className={`text-xs font-bold uppercase tracking-wide py-3 transition-colors ${
                view === "menu" ? "text-orange-600 border-b-2 border-orange-500" : "text-gray-500 hover:text-navy-950"
              }`}
            >
              Atajos
            </button>
            <button
              onClick={() => { setView("faq"); setActiveFaq(null); }}
              className={`text-xs font-bold uppercase tracking-wide py-3 transition-colors ${
                view === "faq" ? "text-orange-600 border-b-2 border-orange-500" : "text-gray-500 hover:text-navy-950"
              }`}
            >
              Preguntas frecuentes
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {view === "menu" ? (
              <ul className="space-y-2">
                {QUICK_ACTIONS.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-orange-50 border border-gray-200 hover:border-orange-300 transition-colors group"
                    >
                      <span className="shrink-0 w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                        {a.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy-950 group-hover:text-orange-700">
                          {a.label}
                        </span>
                        {a.description && (
                          <span className="block text-xs text-gray-500 mt-0.5">{a.description}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1">
                {FAQS.map((f, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full text-left flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      aria-expanded={activeFaq === i}
                    >
                      <span className="text-orange-600 mt-0.5 shrink-0">
                        <svg
                          className={`w-4 h-4 transition-transform ${activeFaq === i ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-navy-950">{f.q}</span>
                        {activeFaq === i && (
                          <span className="block text-xs text-gray-600 mt-2 leading-relaxed">{f.a}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer — escalamiento humano */}
          <div className="border-t border-gray-200 p-3 bg-gray-50">
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_DEFAULT)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-xl text-sm transition-colors"
            >
              {ICON_WA}
              Hablar con un vendedor por WhatsApp
            </a>
            <p className="text-[10px] text-gray-500 text-center mt-2">
              Atendemos lunes a viernes 8:30–18:30 · sábado 9:00–13:00
            </p>
          </div>
        </div>
      )}
    </>
  );
}
