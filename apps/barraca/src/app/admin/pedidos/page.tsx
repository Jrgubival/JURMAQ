"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { montoDespacho, nombreCourier } from "@/lib/despacho/texto";
import { MOTIVOS_RECHAZO, type MotivoRechazo } from "@/lib/pedidos/motivos";
import { linkWhatsappPedido } from "@/lib/admin/whatsapp";

/**
 * /admin/pedidos — pedidos de la tienda en línea, pensado para el celular.
 * Filtro por grupo de estado, tarjeta con el detalle, WhatsApp al cliente,
 * avanzar el estado (las reglas de transición viven en el servidor:
 * /api/admin/pedidos/[numero]) y "No aprobar" con motivo + devolución
 * (/api/admin/pedidos/[numero]/rechazar).
 */

type Estado =
  | "pendiente_pago" | "pagado" | "pago_rechazado" | "pago_discrepancia"
  | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado" | "rechazado";

const ETIQUETA: Record<Estado, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  pago_rechazado: "Pago rechazado",
  pago_discrepancia: "Pago por revisar",
  en_preparacion: "En preparación",
  listo_retiro: "Listo para retiro",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "No aprobado",
};

const COLOR: Record<Estado, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800",
  pagado: "bg-green-100 text-green-800",
  pago_rechazado: "bg-red-100 text-red-800",
  pago_discrepancia: "bg-red-100 text-red-800",
  en_preparacion: "bg-blue-100 text-blue-800",
  listo_retiro: "bg-indigo-100 text-indigo-800",
  despachado: "bg-indigo-100 text-indigo-800",
  entregado: "bg-gray-200 text-gray-700",
  cancelado: "bg-gray-200 text-gray-500",
  rechazado: "bg-red-100 text-red-800",
};

type Grupo = "todos" | "por_pagar" | "pagado" | "preparando" | "listo" | "entregado" | "rechazado" | "cancelado" | "por_preparar";

const GRUPOS: Array<{ id: Grupo; label: string; estados: Estado[] | null }> = [
  { id: "todos", label: "Todos", estados: null },
  { id: "por_pagar", label: "Por pagar", estados: ["pendiente_pago", "pago_rechazado", "pago_discrepancia"] },
  { id: "pagado", label: "Pagado", estados: ["pagado"] },
  { id: "preparando", label: "Preparando", estados: ["en_preparacion"] },
  { id: "listo", label: "Listo", estados: ["listo_retiro", "despachado"] },
  { id: "entregado", label: "Entregado", estados: ["entregado"] },
  { id: "rechazado", label: "No aprobado", estados: ["rechazado"] },
  { id: "cancelado", label: "Cancelado", estados: ["cancelado"] },
];
/** Atajo desde el Resumen: pagados + en preparación. No tiene chip propio. */
const POR_PREPARAR: Estado[] = ["pagado", "en_preparacion"];

interface Pedido {
  numero: string;
  estado: Estado;
  metodo_pago: "webpay" | "mercadopago" | "transferencia";
  entrega: "retiro" | "despacho";
  direccion: string | null;
  comuna: string | null;
  nombre: string;
  rut: string | null;
  telefono: string;
  email: string;
  notas: string | null;
  items: Array<{ productoId: number; codigo: string | null; nombre: string; cantidad: number; precio: number; subtotal: number }>;
  subtotal?: number;
  costo_despacho: number | null;
  despacho_tipo?: "propio" | "courier" | null;
  courier?: string | null;
  courier_seguimiento?: string | null;
  courier_etiqueta_url?: string | null;
  pasarela?: string | null;
  pagado_at?: string | null;
  rechazo_motivo?: MotivoRechazo | null;
  rechazo_nota?: string | null;
  reembolso?: { estado: "hecho" | "pendiente" | "error" | "en_curso"; medio: "webpay" | "transferencia"; monto: number } | null;
  total: number;
  pago_id: string | null;
  created_at: string;
}

const fmt = (n: number) => `$${Number(n).toLocaleString("es-CL")}`;
const fecha = (s: string) => new Date(s).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
const medioPago = (m: Pedido["metodo_pago"]) => (m === "transferencia" ? "Transferencia" : m === "webpay" ? "Webpay" : "Mercado Pago");

/** Siguientes pasos razonables desde cada estado (el servidor vuelve a validarlos). */
function acciones(p: Pedido): Array<{ estado: Estado; label: string; principal?: boolean }> {
  switch (p.estado) {
    case "pendiente_pago":
    case "pago_rechazado":
      return [
        ...(p.metodo_pago === "transferencia"
          ? [{ estado: "pagado" as Estado, label: "Marcar pagado (llegó la transferencia)", principal: true }]
          : []),
        { estado: "cancelado", label: "Cancelar pedido" },
      ];
    case "pago_discrepancia":
      return [{ estado: "cancelado", label: "Cancelar pedido" }];
    case "pagado":
      return [{ estado: "en_preparacion", label: "Empezar a preparar", principal: true }];
    case "en_preparacion":
      return [p.entrega === "retiro"
        ? { estado: "listo_retiro", label: "Listo para retiro", principal: true }
        : { estado: "despachado", label: "Salió el despacho", principal: true }];
    case "listo_retiro":
    case "despachado":
      return [{ estado: "entregado", label: "Marcar entregado", principal: true }];
    default:
      return [];
  }
}

const RECHAZABLE: Estado[] = ["pendiente_pago", "pago_rechazado", "pago_discrepancia", "pagado", "en_preparacion", "listo_retiro"];

export default function PedidosAdminPage() {
  const [lista, setLista] = useState<Pedido[]>([]);
  const [grupo, setGrupo] = useState<Grupo>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<{ numero: string; motivo: MotivoRechazo | ""; nota: string } | null>(null);

  // ?grupo= y ?n= (links del Resumen). Se leen una vez, sin useSearchParams.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get("grupo") as Grupo | null;
    if (g && (g === "por_preparar" || GRUPOS.some((x) => x.id === g))) setGrupo(g);
    const n = sp.get("n");
    if (n) setAbierto(n);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pedidos", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLista(data.pedidos || []);
      else setError(data.error || "No se pudieron cargar los pedidos");
    } catch {
      setError("Sin conexión. Revisa el internet y vuelve a intentar.");
    }
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const conteo = useMemo(() => {
    const c: Partial<Record<Grupo, number>> = { todos: lista.length };
    for (const g of GRUPOS) if (g.estados) c[g.id] = lista.filter((p) => g.estados!.includes(p.estado)).length;
    return c;
  }, [lista]);

  const visibles = useMemo(() => {
    const estados = grupo === "por_preparar" ? POR_PREPARAR : GRUPOS.find((g) => g.id === grupo)?.estados ?? null;
    const q = busqueda.trim().toLowerCase();
    return lista.filter((p) =>
      (!estados || estados.includes(p.estado)) &&
      (!q || p.numero.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q) || p.telefono.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000")),
    );
  }, [lista, grupo, busqueda]);

  async function cambiar(numero: string, estado: Estado) {
    if (estado === "cancelado" && !confirm(`¿Cancelar el pedido ${numero}? Se devuelve el stock.`)) return;
    if (estado === "pagado" && !confirm(`¿Confirmas que llegó la transferencia del pedido ${numero}? Revisa la cartola antes.`)) return;
    setGuardando(numero);
    const res = await fetch(`/api/admin/pedidos/${encodeURIComponent(numero)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(null);
    if (!res?.ok) {
      alert(data.error || "No se pudo actualizar");
      return;
    }
    void cargar();
  }

  /** No aprobar un pedido: motivo de la lista cerrada, con confirmación (anula el pago en Webpay si se pagó). */
  async function rechazar(p: Pedido, motivo: MotivoRechazo, nota: string) {
    const webpay = p.pasarela === "webpay" && !!p.pagado_at;
    const devolucion = !p.pagado_at
      ? "No hubo cobro."
      : webpay
        ? `Se anulará el pago en Webpay por ${fmt(p.total)} (devolución automática a la tarjeta).`
        : `Hay que devolver ${fmt(p.total)} por transferencia (a mano).`;
    if (!confirm(`¿No aprobar el pedido ${p.numero}?\n\nMotivo: ${MOTIVOS_RECHAZO[motivo]}\n${devolucion}\nSe devuelve el stock y se avisa al cliente por correo.`)) return;
    setGuardando(p.numero);
    const res = await fetch(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "rechazar", motivo, nota: nota || undefined }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(null);
    if (!res?.ok) { alert(data.error || "No se pudo rechazar"); return; }
    if (data.reembolso === "error") alert("El pedido quedó como no aprobado, pero Webpay no confirmó la anulación. Usa \"Reintentar devolución\" o revisa el portal de Transbank.");
    setRechazando(null);
    void cargar();
  }

  async function reintentarReembolso(p: Pedido) {
    if (!confirm(`¿Anular en Webpay el pago de ${fmt(p.total)} del pedido ${p.numero}?`)) return;
    setGuardando(p.numero);
    const res = await fetch(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "reembolsar" }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(null);
    if (!res?.ok) alert(data.error || "Webpay no confirmó la anulación");
    void cargar();
  }

  async function generarEnvio(p: Pedido, manual: boolean) {
    let seguimiento: string | undefined;
    if (manual) {
      const v = prompt(`N° de seguimiento de ${nombreCourier(p.courier)} para ${p.numero}:`);
      if (!v?.trim()) return;
      seguimiento = v.trim();
    } else if (!confirm(`¿Crear el envío de ${p.numero} en ${nombreCourier(p.courier)}? El courier lo cobra a la cuenta de la barraca.`)) {
      return;
    }
    setGuardando(p.numero);
    const res = await fetch(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/envio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seguimiento ? { seguimiento } : {}),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(null);
    if (!res?.ok) {
      alert(data.error || "No se pudo generar el envío");
      return;
    }
    if (typeof data.etiquetaUrl === "string" && data.etiquetaUrl.startsWith("https://")) window.open(data.etiquetaUrl, "_blank", "noopener");
    void cargar();
  }

  const btnBase = "min-h-[44px] px-4 rounded-xl text-sm font-semibold disabled:opacity-60";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="flex-1">
          <span className="sr-only">Buscar pedido</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, nombre o teléfono"
            className="w-full min-h-[44px] px-3 rounded-xl border border-gray-300 bg-white text-base text-gray-900"
          />
        </label>
        <button onClick={() => void cargar()} className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700" aria-label="Actualizar lista">
          ↻
        </button>
      </div>

      {/* Chips: se envuelven en varias líneas, sin scroll horizontal */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar por estado">
        {grupo === "por_preparar" && (
          <button aria-pressed className="min-h-[44px] px-4 rounded-full text-sm font-semibold bg-gray-900 text-white">
            Por preparar ({lista.filter((p) => POR_PREPARAR.includes(p.estado)).length})
          </button>
        )}
        {GRUPOS.map((g) => {
          const activo = grupo === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGrupo(g.id)}
              aria-pressed={activo}
              className={`min-h-[44px] px-4 rounded-full text-sm font-semibold border ${
                activo ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {g.label} <span className={activo ? "text-white/70" : "text-gray-400"}>{conteo[g.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      {cargando ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl p-8 text-center">No hay pedidos en este grupo.</p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((p) => {
            const wa = linkWhatsappPedido(p);
            const ocupado = guardando === p.numero;
            return (
              <li key={p.numero} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setAbierto(abierto === p.numero ? null : p.numero)}
                  aria-expanded={abierto === p.numero}
                  className="w-full text-left px-4 py-3 min-h-[64px]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">{p.numero}</span>
                    <span className="text-base font-bold text-gray-900 tabular-nums">{fmt(p.total)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR[p.estado]}`}>{ETIQUETA[p.estado]}</span>
                    <span className="text-sm text-gray-700 truncate max-w-full">{p.nombre}</span>
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {medioPago(p.metodo_pago)} · {p.entrega === "retiro" ? "Retiro en la barraca" : `Despacho ${p.comuna ?? ""}`} · {fecha(p.created_at)}
                  </span>
                </button>

                {abierto === p.numero && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4 text-sm">
                    {/* Contacto */}
                    <div className="grid grid-cols-2 gap-2">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btnBase} col-span-2 flex items-center justify-center gap-2 bg-green-600 text-white`}>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0012 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 005.6 1.4h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.3zM12 21.7c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 01-1.5-5.2c0-5.5 4.4-9.9 9.9-9.9 2.6 0 5.1 1 7 2.9a9.8 9.8 0 012.9 7c0 5.5-4.5 9.9-9.9 9.9zm5.4-7.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 01-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.8 2.5.8 3.4.7.6-.1 1.8-.7 2-1.4s.3-1.3.2-1.4l-.4-.1z" /></svg>
                          Escribir por WhatsApp
                        </a>
                      ) : (
                        <p className="col-span-2 text-xs text-gray-500">El teléfono no sirve para WhatsApp: {p.telefono}</p>
                      )}
                      <a href={`tel:${p.telefono.replace(/[^\d+]/g, "")}`} className={`${btnBase} flex items-center justify-center border border-gray-300 text-gray-800`}>Llamar</a>
                      <a href={`mailto:${p.email}`} className={`${btnBase} flex items-center justify-center border border-gray-300 text-gray-800`}>Correo</a>
                    </div>

                    {/* Cliente y entrega */}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <dt className="text-gray-500">Cliente</dt><dd className="text-gray-900 break-words">{p.nombre}{p.rut ? ` · RUT ${p.rut}` : ""}</dd>
                      <dt className="text-gray-500">Teléfono</dt><dd className="text-gray-900">{p.telefono}</dd>
                      <dt className="text-gray-500">Correo</dt><dd className="text-gray-900 break-all">{p.email}</dd>
                      <dt className="text-gray-500">Pago</dt><dd className="text-gray-900">{medioPago(p.metodo_pago)}{p.pagado_at ? ` · pagado ${fecha(p.pagado_at)}` : " · sin pagar"}</dd>
                      <dt className="text-gray-500">Entrega</dt>
                      <dd className="text-gray-900 break-words">
                        {p.entrega === "retiro" ? "Retira en la barraca" : (
                          <>
                            {p.despacho_tipo === "courier" ? `Courier (${nombreCourier(p.courier)})` : "Camión"}: {p.direccion}, {p.comuna} · {montoDespacho(p)}
                            {p.courier_seguimiento && <span className="block text-xs text-gray-600">Seguimiento: <span className="font-mono">{p.courier_seguimiento}</span></span>}
                            {p.courier_etiqueta_url?.startsWith("https://") && (
                              <a className="block text-xs text-blue-700 underline min-h-[44px] leading-[44px]" href={p.courier_etiqueta_url} target="_blank" rel="noopener noreferrer">
                                Imprimir etiqueta (PDF)
                              </a>
                            )}
                          </>
                        )}
                      </dd>
                      {p.notas && (<><dt className="text-gray-500">Nota</dt><dd className="text-gray-900 break-words">{p.notas}</dd></>)}
                    </dl>

                    {/* Productos */}
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Productos</p>
                      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                        {p.items.map((i) => (
                          <li key={i.productoId} className="flex justify-between gap-3 px-3 py-2">
                            <span className="min-w-0 break-words"><strong>{i.cantidad} ×</strong> {i.nombre}{i.codigo ? <span className="text-gray-400"> ({i.codigo})</span> : null}</span>
                            <span className="tabular-nums shrink-0">{fmt(i.subtotal)}</span>
                          </li>
                        ))}
                        {p.entrega === "despacho" && (
                          <li className="flex justify-between gap-3 px-3 py-2 text-gray-600"><span>Despacho</span><span className="tabular-nums">{montoDespacho(p)}</span></li>
                        )}
                        <li className="flex justify-between gap-3 px-3 py-2 font-bold text-gray-900"><span>Total</span><span className="tabular-nums">{fmt(p.total)}</span></li>
                      </ul>
                    </div>

                    {p.despacho_tipo === "courier" && !p.courier_seguimiento && (p.estado === "pagado" || p.estado === "en_preparacion") && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button disabled={ocupado} onClick={() => generarEnvio(p, false)} className={`${btnBase} bg-blue-700 text-white`}>
                          Generar envío {nombreCourier(p.courier)}
                        </button>
                        <button disabled={ocupado} onClick={() => generarEnvio(p, true)} className={`${btnBase} border border-gray-300 text-gray-800`}>
                          Ingresar seguimiento a mano
                        </button>
                      </div>
                    )}

                    {p.estado === "rechazado" && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-red-900">
                        <p><strong>No aprobado:</strong> {p.rechazo_motivo ? MOTIVOS_RECHAZO[p.rechazo_motivo] : "—"}{p.rechazo_nota ? ` · ${p.rechazo_nota}` : ""}</p>
                        {p.reembolso && (
                          <p className="mt-0.5">
                            Devolución {p.reembolso.medio === "webpay" ? "Webpay" : "por transferencia"} de {fmt(p.reembolso.monto)}:{" "}
                            <strong>{p.reembolso.estado === "hecho" ? "hecha" : p.reembolso.estado === "pendiente" ? "pendiente (hacerla a mano)" : p.reembolso.estado === "en_curso" ? "en curso" : "falló"}</strong>
                          </p>
                        )}
                        {p.reembolso?.medio === "webpay" && p.reembolso.estado === "error" && (
                          <button disabled={ocupado} onClick={() => reintentarReembolso(p)} className={`${btnBase} mt-2 w-full bg-red-700 text-white`}>
                            Reintentar devolución en Webpay
                          </button>
                        )}
                      </div>
                    )}

                    {/* Cambiar estado */}
                    {acciones(p).length > 0 && (
                      <div className="grid gap-2">
                        {acciones(p).map((a) => (
                          <button
                            key={a.estado}
                            disabled={ocupado}
                            onClick={() => cambiar(p.numero, a.estado)}
                            className={`${btnBase} w-full ${
                              a.principal ? "bg-gray-900 text-white" : a.estado === "cancelado" ? "border border-red-200 text-red-700" : "border border-gray-300 text-gray-800"
                            }`}
                          >
                            {ocupado ? "Guardando…" : a.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {RECHAZABLE.includes(p.estado) && (
                      <div className="pt-3 border-t border-gray-100">
                        {rechazando?.numero !== p.numero ? (
                          <button onClick={() => setRechazando({ numero: p.numero, motivo: "", nota: "" })} className="min-h-[44px] text-sm font-semibold text-red-700">
                            No aprobar este pedido…
                          </button>
                        ) : (
                          <div className="grid gap-2">
                            <label className="text-xs text-gray-600">Motivo
                              <select value={rechazando.motivo} onChange={(e) => setRechazando({ ...rechazando, motivo: e.target.value as MotivoRechazo })} className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-xl px-2 text-base text-gray-900 bg-white">
                                <option value="">Elige el motivo</option>
                                {(Object.keys(MOTIVOS_RECHAZO) as MotivoRechazo[]).map((m) => <option key={m} value={m}>{MOTIVOS_RECHAZO[m]}</option>)}
                              </select>
                            </label>
                            <label className="text-xs text-gray-600">Nota interna (opcional)
                              <input value={rechazando.nota} maxLength={500} onChange={(e) => setRechazando({ ...rechazando, nota: e.target.value })} className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-xl px-2 text-base text-gray-900" />
                            </label>
                            {rechazando.motivo === "sin_despacho" && (
                              <p className="text-xs text-gray-600">Antes de rechazar, ofrécele al cliente retirar en la barraca. El correo también se lo ofrece.</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setRechazando(null)} className={`${btnBase} border border-gray-300 text-gray-700`}>Volver</button>
                              <button disabled={!rechazando.motivo || ocupado} onClick={() => rechazando.motivo && rechazar(p, rechazando.motivo, rechazando.nota)} className={`${btnBase} bg-red-700 text-white`}>
                                No aprobar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
