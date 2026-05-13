"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCLP } from "@jurmaq/shared/format";

interface CotizacionItem {
  nombre: string;
  cantidad: number;
  precio: number;
  medida?: string;
}

interface ContraofertaItem {
  nombre: string;
  cantidad: number;
  precioOriginal: number;
  precioContraoferta: number;
}

interface CotizacionData {
  id: number;
  numero: string;
  nombre: string;
  empresa: string | null;
  email: string;
  telefono: string;
  items: string | CotizacionItem[];
  total: number;
  estado: string;
  nombre_competencia: string | null;
  cotizacion_competencia: string | null;
  contraoferta_items: string | ContraofertaItem[] | null;
  contraoferta_total: number | null;
  contraoferta_mensaje: string | null;
  metodo_pago: string | null;
  payment_url: string | null;
  created_at: string;
}
export default function CotizacionPublicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const numero = params.numero as string;
  const action = searchParams.get("action");
  const tokenQuery = searchParams.get("token") || "";
  // Email from query string — supplied by email links and admin; required for full PII + accept/reject
  const emailQuery = searchParams.get("email") || "";

  const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    fetchCotizacion();
  }, [numero]);

  async function fetchCotizacion() {
    try {
      const url = emailQuery
        ? `/api/barraca/cotizaciones/by-numero/${numero}?email=${encodeURIComponent(emailQuery)}`
        : `/api/barraca/cotizaciones/by-numero/${numero}`;
      const res = await fetch(url);
      if (!res.ok) {
        setError("Cotizacion no encontrada");
        return;
      }
      const data = await res.json();
      setCotizacion(data);
    } catch {
      setError("Error al cargar la cotizacion");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(act: "accept" | "reject") {
    if (!cotizacion) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/barraca/cotizaciones/${cotizacion.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: act,
          email: emailQuery || cotizacion.email,
          ...(tokenQuery && { token: tokenQuery }),
        }),
      });
      if (res.ok) {
        setActionDone(act === "accept" ? "accepted" : "rejected");
        if (act === "accept") {
          try {
            const { trackEvents } = await import("@/lib/analytics");
            const ahorro =
              cotizacion.contraoferta_total != null
                ? Math.max(0, cotizacion.total - cotizacion.contraoferta_total)
                : 0;
            trackEvents.contraofertaAcepted(cotizacion.numero, ahorro);
          } catch { /* analytics no debe romper UX */ }
        }
        fetchCotizacion();
      } else {
        const data = await res.json();
        setError(data.error || "Error al procesar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setActionLoading(false);
    }
  }

  const parseItems = (items: string | CotizacionItem[]): CotizacionItem[] => {
    if (Array.isArray(items)) return items;
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  };

  const parseContraofertaItems = (items: string | ContraofertaItem[] | null): ContraofertaItem[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !cotizacion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-md">
          <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Cotizacion no encontrada</h1>
          <p className="text-gray-500 mb-6">El enlace puede estar incorrecto o la cotizacion ya no existe.</p>
          <Link href="/barraca" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors">
            Ir al Inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!cotizacion) return null;

  const originalItems = parseItems(cotizacion.items);
  const contraofertaItems = parseContraofertaItems(cotizacion.contraoferta_items);
  const isContraoferta = cotizacion.estado === "contraoferta" && contraofertaItems.length > 0;
  const isAccepted = cotizacion.estado === "aceptada";
  const isRejected = cotizacion.estado === "rechazada";

  const totalOriginal = contraofertaItems.reduce((s, i) => s + i.precioOriginal * i.cantidad, 0) || cotizacion.total;
  const totalContraoferta = cotizacion.contraoferta_total || 0;
  const ahorro = totalOriginal - totalContraoferta;
  const ahorroPercent = totalOriginal > 0 ? Math.round((ahorro / totalOriginal) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0c1d3a] text-white py-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold">JURMAQ</h1>
          <p className="text-orange-500 text-sm font-semibold uppercase tracking-widest mt-1">Barraca</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success/Rejection messages */}
        {actionDone === "accepted" && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 mx-auto text-green-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-lg font-bold text-green-800 mb-1">Contraoferta Aceptada</h2>
            <p className="text-green-700 text-sm">Te contactaremos a la brevedad para coordinar el pago y la entrega.</p>
          </div>
        )}

        {actionDone === "rejected" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-bold text-red-800 mb-1">Contraoferta Rechazada</h2>
            <p className="text-red-700 text-sm">Lamentamos que no hayamos podido llegar a un acuerdo. Puedes contactarnos para negociar.</p>
          </div>
        )}

        {/* Quote info */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cotización #{cotizacion.numero}</h2>
              <p className="text-sm text-gray-500">
                {new Date(cotizacion.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              isContraoferta ? "bg-purple-100 text-purple-700" :
              isAccepted ? "bg-green-100 text-green-700" :
              isRejected ? "bg-red-100 text-red-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {isContraoferta ? "Contraoferta disponible" :
               isAccepted ? "Aceptada" :
               isRejected ? "Rechazada" :
               cotizacion.estado.charAt(0).toUpperCase() + cotizacion.estado.slice(1)}
            </span>
          </div>

          <div className="p-6">
            {/* Client info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
                <p className="font-medium text-gray-900">{cotizacion.nombre}</p>
              </div>
              {cotizacion.empresa && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Empresa</p>
                  <p className="text-gray-700">{cotizacion.empresa}</p>
                </div>
              )}
            </div>

            {/* Counter-offer comparison */}
            {isContraoferta && contraofertaItems.length > 0 && (
              <>
                {/* Savings banner */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white text-center mb-6">
                  <p className="text-sm font-medium opacity-90 mb-1">
                    Te mejoramos el precio de {cotizacion.nombre_competencia || "la competencia"}
                  </p>
                  <div className="text-4xl font-bold mb-1">
                    Ahorras {formatCLP(ahorro)}
                  </div>
                  <p className="text-lg font-semibold opacity-90">
                    {ahorroPercent}% menos que {cotizacion.nombre_competencia || "la competencia"}
                  </p>
                </div>

                {/* Admin message */}
                {cotizacion.contraoferta_mensaje && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-blue-800 mb-1">Mensaje de JURMAQ:</p>
                    <p className="text-sm text-blue-700">{cotizacion.contraoferta_mensaje}</p>
                  </div>
                )}

                {/* Comparison table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-gray-600 font-semibold">Producto</th>
                          <th className="text-center px-3 py-3 text-gray-600 font-semibold">Cant.</th>
                          <th className="text-right px-3 py-3 text-red-600 font-semibold">
                            {cotizacion.nombre_competencia || "Competencia"}
                          </th>
                          <th className="text-right px-4 py-3 text-green-600 font-semibold">JURMAQ</th>
                          <th className="text-right px-3 py-3 text-gray-600 font-semibold">Ahorro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contraofertaItems.map((item, idx) => {
                          const itemAhorro = (item.precioOriginal - item.precioContraoferta) * item.cantidad;
                          return (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="px-4 py-3 font-medium text-gray-900">{item.nombre}</td>
                              <td className="px-3 py-3 text-center text-gray-600">{item.cantidad}</td>
                              <td className="px-3 py-3 text-right text-red-600 line-through">
                                {formatCLP(item.precioOriginal)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {formatCLP(item.precioContraoferta)}
                              </td>
                              <td className="px-3 py-3 text-right text-green-600 font-medium">
                                -{formatCLP(itemAhorro)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={2} className="px-4 py-3 font-semibold text-gray-900">Total</td>
                          <td className="px-3 py-3 text-right text-red-600 font-semibold line-through">
                            {formatCLP(totalOriginal)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                            {formatCLP(totalContraoferta)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-green-600">
                            -{formatCLP(ahorro)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Action buttons */}
                {!actionDone && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleAction("accept")}
                      disabled={actionLoading}
                      className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-base flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Aceptar Contraoferta
                    </button>
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading}
                      className="flex-1 py-3.5 border-2 border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-xl transition-colors disabled:opacity-50 text-base"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Regular items (when no counter-offer) */}
            {!isContraoferta && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Producto</th>
                      <th className="text-center px-3 py-3 text-gray-600 font-semibold">Cant.</th>
                      <th className="text-right px-3 py-3 text-gray-600 font-semibold">Precio</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {originalItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.nombre}</div>
                          {item.medida && <div className="text-xs text-gray-500">{item.medida}</div>}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">{item.cantidad}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{formatCLP(item.precio)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCLP(item.precio * item.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-lg text-orange-600">{formatCLP(cotizacion.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Payment section for accepted cotizaciones */}
            {isAccepted && cotizacion.payment_url && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold text-blue-800 mb-2">Link de Pago</h3>
                <a
                  href={cotizacion.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Pagar Ahora
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">Tienes dudas? Contactanos</p>
          <a
            href={`https://wa.me/56976673577?text=${encodeURIComponent(`Hola, tengo una consulta sobre la cotización ${cotizacion.numero}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-green-300 text-green-700 hover:bg-green-50 font-medium rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
