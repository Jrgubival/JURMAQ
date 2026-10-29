"use client";

import { useCallback, useEffect, useState } from "react";
import { montoDespacho, nombreCourier } from "@/lib/despacho/texto";

/**
 * /admin/pedidos — pedidos de la tienda en línea.
 * Ver el detalle, marcar una transferencia como pagada (descuenta stock) y
 * avanzar el estado: en preparación → listo para retiro / despachado → entregado.
 */

type Estado =
  | "pendiente_pago" | "pagado" | "pago_rechazado" | "pago_discrepancia"
  | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado";

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
};

interface Pedido {
  numero: string;
  estado: Estado;
  metodo_pago: "mercadopago" | "transferencia";
  entrega: "retiro" | "despacho";
  direccion: string | null;
  comuna: string | null;
  nombre: string;
  rut: string | null;
  telefono: string;
  email: string;
  notas: string | null;
  items: Array<{ productoId: number; codigo: string | null; nombre: string; cantidad: number; precio: number; subtotal: number }>;
  costo_despacho: number | null;
  despacho_tipo?: "propio" | "courier" | null;
  courier?: string | null;
  courier_seguimiento?: string | null;
  total: number;
  pago_id: string | null;
  created_at: string;
}

const fmt = (n: number) => `$${Number(n).toLocaleString("es-CL")}`;
const fecha = (s: string) => new Date(s).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

/** Siguientes pasos razonables desde cada estado. */
function acciones(p: Pedido): Array<{ estado: Estado; label: string; principal?: boolean }> {
  switch (p.estado) {
    case "pendiente_pago":
    case "pago_rechazado":
      return [
        ...(p.metodo_pago === "transferencia" || p.estado === "pago_rechazado"
          ? [{ estado: "pagado" as Estado, label: "Marcar pagado", principal: true }]
          : []),
        { estado: "cancelado", label: "Cancelar pedido" },
      ];
    case "pago_discrepancia":
      return [{ estado: "cancelado", label: "Cancelar pedido" }];
    case "pagado":
      return [{ estado: "en_preparacion", label: "En preparación", principal: true }];
    case "en_preparacion":
      return [p.entrega === "retiro"
        ? { estado: "listo_retiro", label: "Listo para retiro", principal: true }
        : { estado: "despachado", label: "Despachado", principal: true }];
    case "listo_retiro":
    case "despachado":
      return [{ estado: "entregado", label: "Entregado", principal: true }];
    default:
      return [];
  }
}

export default function PedidosAdminPage() {
  const [lista, setLista] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Estado | "">("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const res = await fetch(`/api/admin/pedidos${filtro ? `?estado=${filtro}` : ""}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setLista(data.pedidos || []);
    else setError(data.error || "No se pudieron cargar los pedidos");
    setCargando(false);
  }, [filtro]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiar(numero: string, estado: Estado) {
    if (estado === "cancelado" && !confirm(`¿Cancelar el pedido ${numero}?`)) return;
    setGuardando(numero);
    const res = await fetch(`/api/admin/pedidos/${numero}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(null);
    if (!res.ok) {
      alert(data.error || "No se pudo actualizar");
      return;
    }
    void cargar();
  }

  async function generarEnvio(p: Pedido, manual: boolean) {
    let seguimiento: string | undefined;
    if (manual) {
      const v = prompt(`N° de seguimiento de ${nombreCourier(p.courier)} para ${p.numero}:`);
      if (!v?.trim()) return;
      seguimiento = v.trim();
    }
    setGuardando(p.numero);
    const res = await fetch(`/api/admin/pedidos/${p.numero}/envio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seguimiento ? { seguimiento } : {}),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(null);
    if (!res.ok) {
      alert(data.error || "No se pudo generar el envío");
      return;
    }
    if (data.etiquetaUrl) window.open(data.etiquetaUrl, "_blank", "noopener");
    void cargar();
  }

  const porCobrar = lista.filter((p) => p.estado === "pendiente_pago").length;
  const porPreparar = lista.filter((p) => p.estado === "pagado").length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos web</h1>
          <p className="text-sm text-gray-500 mt-1">
            {porPreparar} pagados por preparar · {porCobrar} esperando pago
          </p>
        </div>
        <label className="text-sm text-gray-700">
          <span className="block mb-1 font-medium">Estado</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Estado | "")} className="h-10 px-3 border border-gray-300 rounded-lg bg-white">
            <option value="">Todos</option>
            {(Object.keys(ETIQUETA) as Estado[]).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {cargando ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-8 text-center">No hay pedidos{filtro ? " con ese estado" : ""}.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.numero} className="bg-white border border-gray-200 rounded-xl">
              <button
                onClick={() => setAbierto(abierto === p.numero ? null : p.numero)}
                aria-expanded={abierto === p.numero}
                className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
              >
                <span className="font-mono text-sm font-semibold text-gray-900">{p.numero}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR[p.estado]}`}>{ETIQUETA[p.estado]}</span>
                <span className="text-sm text-gray-700 flex-1 min-w-[140px] truncate">{p.nombre}</span>
                <span className="text-xs text-gray-500">{p.metodo_pago === "transferencia" ? "Transferencia" : "Mercado Pago"} · {p.entrega === "retiro" ? "Retiro" : `Despacho ${p.comuna ?? ""}`}</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(p.total)}</span>
                <span className="text-xs text-gray-400 tabular-nums">{fecha(p.created_at)}</span>
              </button>
              {abierto === p.numero && (
                <div className="border-t border-gray-100 px-4 py-4 grid gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Comprador</p>
                    <p>{p.nombre}{p.rut ? ` · RUT ${p.rut}` : ""}</p>
                    <p><a className="text-blue-700 underline" href={`tel:${p.telefono}`}>{p.telefono}</a> · <a className="text-blue-700 underline" href={`mailto:${p.email}`}>{p.email}</a></p>
                    {p.entrega === "despacho" && (
                      <p className="mt-1">
                        {p.despacho_tipo === "courier" ? `Courier (${nombreCourier(p.courier)})` : "Camión"}: {p.direccion}, {p.comuna} · {montoDespacho(p)}
                        {p.courier_seguimiento && <span className="block text-xs text-gray-600">Seguimiento: <span className="font-mono">{p.courier_seguimiento}</span></span>}
                      </p>
                    )}
                    {p.notas && <p className="mt-1 text-gray-600">Nota: {p.notas}</p>}
                    {p.pago_id && <p className="mt-1 text-xs text-gray-500">Pago: {p.pago_id}</p>}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Productos</p>
                    <ul className="space-y-1">
                      {p.items.map((i) => (
                        <li key={i.productoId} className="flex justify-between gap-3">
                          <span>{i.cantidad} × {i.nombre}{i.codigo ? <span className="text-gray-400"> ({i.codigo})</span> : null}</span>
                          <span className="tabular-nums">{fmt(i.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {p.despacho_tipo === "courier" && !p.courier_seguimiento && (p.estado === "pagado" || p.estado === "en_preparacion") && (
                    <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        disabled={guardando === p.numero}
                        onClick={() => generarEnvio(p, false)}
                        className="min-h-[40px] px-4 rounded-lg text-sm font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        Generar envío {nombreCourier(p.courier)}
                      </button>
                      <button
                        disabled={guardando === p.numero}
                        onClick={() => generarEnvio(p, true)}
                        className="min-h-[40px] px-4 rounded-lg text-sm font-semibold border border-gray-300 text-gray-800 disabled:opacity-60"
                      >
                        Ingresar seguimiento a mano
                      </button>
                    </div>
                  )}
                  {acciones(p).length > 0 && (
                    <div className="md:col-span-2 flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {acciones(p).map((a) => (
                        <button
                          key={a.estado}
                          disabled={guardando === p.numero}
                          onClick={() => cambiar(p.numero, a.estado)}
                          className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold disabled:opacity-60 ${
                            a.principal ? "bg-gray-900 text-white hover:bg-black" : a.estado === "cancelado" ? "text-red-700 hover:bg-red-50" : "border border-gray-300 text-gray-800"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
