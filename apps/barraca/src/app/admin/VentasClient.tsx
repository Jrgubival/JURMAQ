"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { formatCLP } from "@jurmaq/shared/format";
import {
  PRESETS, GRUPOS_ESTADO, MEDIOS, OPCIONES_ZONA, TONO_ESTADO, diaChile, sumarDias, fechaCorta, textoPeriodo, medioPago, textoEntrega,
  type Periodo, type Filtros, type FilaLista, type Totales, type ConteoAtender, type GrupoEstado,
} from "@/lib/admin/ventas";
import EstadoChip from "@/components/admin/ventas/EstadoChip";

/**
 * Ventas: el período y los filtros viven en la URL; cambiar uno hace
 * router.replace y el servidor vuelve a calcular (lista, totales y conteos).
 * Lo pendiente va arriba (lo ordena el servidor).
 */

interface Props {
  periodo: Periodo;
  filtros: Filtros;
  filas: FilaLista[];
  totales: Totales;
  conteos: Record<GrupoEstado, number>;
  atender: ConteoAtender;
  truncado: boolean;
  puedeExportar: boolean;
}

type Cambios = Partial<{ periodo: string; desde: string; hasta: string; estado: string; medio: string; zona: string; q: string }>;

function armarQuery(periodo: Periodo, f: Filtros, cambios: Cambios): string {
  const v = {
    periodo: periodo.preset as string,
    desde: periodo.desde,
    hasta: periodo.hasta,
    estado: f.estado as string,
    medio: f.medio as string,
    zona: f.zona,
    q: f.q,
    ...cambios,
  };
  const sp = new URLSearchParams();
  if (v.periodo !== "mes") sp.set("periodo", v.periodo);
  if (v.periodo === "rango") { sp.set("desde", v.desde); sp.set("hasta", v.hasta); }
  if (v.estado !== "todos") sp.set("estado", v.estado);
  if (v.medio !== "todos") sp.set("medio", v.medio);
  if (v.zona !== "todas") sp.set("zona", v.zona);
  if (v.q.trim()) sp.set("q", v.q.trim());
  return sp.toString();
}

const claseSelect =
  "w-full min-h-[44px] pl-3 pr-9 rounded-lg border border-[#D9D6CF] bg-white text-[15px] text-[#111111] appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:18px] " +
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236B6A66'%3E%3Cpath fill-rule='evenodd' d='M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z'/%3E%3C/svg%3E\")]";

/** Una línea de la "boleta" de totales: etiqueta, puntos guía, cifra. */
function Linea({ label, valor, grande = false, nota }: { label: string; valor: string; grande?: boolean; nota?: string }) {
  return (
    <div className="flex items-baseline min-w-0">
      <span className={`shrink-0 ${grande ? "text-[15px] font-semibold text-navy-950" : "text-[14px] text-[#4A4945]"}`}>
        {label}
        {nota && <span className="block text-[12px] font-normal text-[#8A8884]">{nota}</span>}
      </span>
      <span aria-hidden="true" className="flex-1 mx-2 border-b border-dotted border-[#C9C5BC] translate-y-[-0.3em] min-w-4" />
      <span className={`cifra shrink-0 text-navy-950 ${grande ? "text-[40px] sm:text-[52px] leading-none font-semibold" : "text-[22px] leading-none font-medium"}`}>
        {valor}
      </span>
    </div>
  );
}

export default function VentasClient({ periodo, filtros, filas, totales, conteos, atender, truncado, puedeExportar }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, startTransition] = useTransition();
  const [q, setQ] = useState(filtros.q);
  const [rango, setRango] = useState<{ abierto: boolean; desde: string; hasta: string }>({
    abierto: periodo.preset === "rango", desde: periodo.desde, hasta: periodo.hasta,
  });
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia por otro lado (atrás/adelante), el buscador la sigue.
  useEffect(() => { setQ(filtros.q); }, [filtros.q]);

  const ir = (cambios: Cambios) => {
    const qs = armarQuery(periodo, { ...filtros, q }, cambios);
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const buscar = (valor: string, ya = false) => {
    setQ(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => ir({ q: valor }), ya ? 0 : 350);
  };

  const hoy = diaChile(new Date());
  const verPendientes = (estado: GrupoEstado) =>
    ir({ estado, periodo: "rango", desde: sumarDias(hoy, -89), hasta: hoy });

  const hayFiltros = filtros.estado !== "todos" || filtros.medio !== "todos" || filtros.zona !== "todas" || !!filtros.q;
  const qsExport = armarQuery(periodo, filtros, {});

  const avisos = [
    { n: atender.informada, label: atender.informada === 1 ? "transferencia por confirmar" : "transferencias por confirmar", estado: "informada" as GrupoEstado, clase: "bg-marca-600 text-white hover:bg-marca-700" },
    { n: atender.revisar, label: atender.revisar === 1 ? "pago por revisar" : "pagos por revisar", estado: "por_pagar" as GrupoEstado, clase: "bg-marca-600 text-white hover:bg-marca-700" },
    { n: atender.porPreparar, label: atender.porPreparar === 1 ? "pedido por preparar" : "pedidos por preparar", estado: "por_preparar" as GrupoEstado, clase: "bg-navy-950 text-white hover:bg-navy-900" },
    { n: atender.porPagar, label: "esperando pago del cliente", estado: "por_pagar" as GrupoEstado, clase: "bg-white text-[#7A4E00] ring-1 ring-inset ring-[#EBD39A] hover:bg-[#FFFaF0]" },
  ].filter((a) => a.n > 0);

  return (
    <div className="space-y-6">
      {/* Encabezado + período */}
      <section aria-labelledby="titulo-ventas" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 id="titulo-ventas" className="cifra text-[30px] sm:text-[34px] leading-none font-semibold uppercase tracking-[0.03em] text-navy-950">
              Ventas
            </h1>
            <p className="mt-1.5 text-[14px] text-[#5F5E5A]">
              {textoPeriodo(periodo)} <span className="text-[#8A8884]">· por fecha del pedido</span>
            </p>
          </div>
          {puedeExportar && (
            <a
              href={`/api/admin/ventas/export${qsExport ? `?${qsExport}` : ""}`}
              className="hidden sm:inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-[#D9D6CF] bg-white text-[14px] font-semibold text-navy-950 hover:border-navy-950"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
              Descargar Excel
            </a>
          )}
        </div>

        <div role="group" aria-label="Período" className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[#EFEDE8]">
          {PRESETS.map((p) => {
            const activo = periodo.preset === p.id && !rango.abierto;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={activo}
                onClick={() => { setRango((r) => ({ ...r, abierto: false })); ir({ periodo: p.id }); }}
                className={`min-h-[44px] px-0.5 rounded-lg text-[13px] sm:text-[14.5px] leading-tight font-semibold transition-colors ${
                  activo ? "bg-white text-navy-950 shadow-[0_1px_2px_rgba(8,20,40,0.12)]" : "text-[#5F5E5A] hover:text-navy-950"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={rango.abierto || periodo.preset === "rango"}
            aria-expanded={rango.abierto}
            onClick={() => setRango((r) => ({ ...r, abierto: !r.abierto }))}
            className={`min-h-[44px] px-0.5 rounded-lg text-[13px] sm:text-[14.5px] leading-tight font-semibold transition-colors ${
              rango.abierto || periodo.preset === "rango" ? "bg-white text-navy-950 shadow-[0_1px_2px_rgba(8,20,40,0.12)]" : "text-[#5F5E5A] hover:text-navy-950"
            }`}
          >
            Fechas
          </button>
        </div>

        {rango.abierto && (
          <form
            className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (rango.desde && rango.hasta) ir({ periodo: "rango", desde: rango.desde, hasta: rango.hasta });
            }}
          >
            <label className="text-[13px] text-[#5F5E5A]">Desde
              <input type="date" value={rango.desde} max={rango.hasta || hoy} onChange={(e) => setRango({ ...rango, desde: e.target.value })}
                className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-[#D9D6CF] bg-white text-[15px] text-[#111111]" />
            </label>
            <label className="text-[13px] text-[#5F5E5A]">Hasta
              <input type="date" value={rango.hasta} min={rango.desde} max={hoy} onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
                className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-[#D9D6CF] bg-white text-[15px] text-[#111111]" />
            </label>
            <button type="submit" disabled={!rango.desde || !rango.hasta || rango.desde > rango.hasta}
              className="col-span-2 sm:col-span-1 min-h-[44px] px-5 rounded-lg bg-navy-950 text-white text-[15px] font-semibold disabled:opacity-50">
              Ver esas fechas
            </button>
          </form>
        )}
      </section>

      {/* Totales del período, como una boleta */}
      <section aria-label="Totales del período" className={`bg-white border border-[#E6E4DF] rounded-xl px-4 sm:px-6 py-5 transition-opacity ${pendiente ? "opacity-60" : ""}`}>
        <Linea grande label="Vendido" valor={formatCLP(totales.vendido)} nota="pedidos pagados" />
        <div className="mt-5 pt-4 border-t border-[#EFEDE8] grid gap-3 sm:grid-cols-3 sm:gap-8">
          <Linea label="N° pedidos" valor={String(totales.pedidos)} />
          <Linea label="Ticket promedio" valor={formatCLP(totales.ticket)} />
          <Linea label="Despachos" valor={formatCLP(totales.despachos)} />
        </div>
      </section>

      {/* Lo que espera a la barraca (últimos 90 días, aunque esté fuera del período) */}
      {avisos.length > 0 && (
        <section aria-labelledby="por-atender">
          <h2 id="por-atender" className="text-[15px] font-semibold text-navy-950 mb-2">Por atender</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {avisos.map((a) => (
              <li key={a.label}>
                <button type="button" onClick={() => verPendientes(a.estado)}
                  className={`w-full flex items-center gap-3 min-h-[56px] px-4 rounded-xl text-left transition-colors ${a.clase}`}>
                  <span className="cifra text-[30px] leading-none font-semibold">{a.n}</span>
                  <span className="text-[15px] font-semibold leading-tight">{a.label}</span>
                  <span aria-hidden="true" className="ml-auto text-[20px] opacity-70">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtros */}
      <section aria-label="Filtros" className="space-y-3">
        <div role="group" aria-label="Estado" className="flex flex-wrap gap-1.5">
          {GRUPOS_ESTADO.map((g) => {
            const activo = filtros.estado === g.id;
            const n = conteos[g.id] ?? 0;
            if (!activo && n === 0 && g.id !== "todos") return null;
            return (
              <button key={g.id} type="button" aria-pressed={activo} onClick={() => ir({ estado: g.id })}
                className={`min-h-[44px] px-3.5 rounded-lg text-[14px] font-semibold border transition-colors ${
                  activo ? "bg-navy-950 text-white border-navy-950" : g.id === "informada" ? "bg-marca-50 text-marca-800 border-marca-200 hover:border-marca-600" : "bg-white text-[#2B2A28] border-[#D9D6CF] hover:border-navy-950"
                }`}>
                {g.label} <span className={`cifra ml-0.5 ${activo ? "text-white/70" : "text-[#8A8884]"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <label className="col-span-2 sm:col-span-1 relative">
            <span className="sr-only">Buscar por N° de pedido, nombre, teléfono o RUT</span>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8A8884] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" /></svg>
            <input
              type="search"
              value={q}
              onChange={(e) => buscar(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") buscar(q, true); }}
              placeholder="N° pedido, nombre, teléfono o RUT"
              enterKeyHint="search"
              className="w-full min-h-[44px] pl-10 pr-3 rounded-lg border border-[#D9D6CF] bg-white text-[16px] text-[#111111] placeholder:text-[#8A8884]"
            />
          </label>
          <label>
            <span className="sr-only">Medio de pago</span>
            <select value={filtros.medio} onChange={(e) => ir({ medio: e.target.value })} className={claseSelect}>
              {MEDIOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Entrega o zona de despacho</span>
            <select value={filtros.zona} onChange={(e) => ir({ zona: e.target.value })} className={claseSelect}>
              {OPCIONES_ZONA.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* Lista */}
      <section aria-labelledby="lista-ventas" className={`transition-opacity ${pendiente ? "opacity-60" : ""}`} aria-busy={pendiente}>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 id="lista-ventas" className="text-[15px] font-semibold text-navy-950">
            {filas.length} {filas.length === 1 ? "pedido" : "pedidos"}
            {pendiente && <span className="ml-2 text-[13px] font-normal text-[#8A8884]">actualizando…</span>}
          </h2>
          {hayFiltros && (
            <button type="button" onClick={() => { setQ(""); ir({ estado: "todos", medio: "todos", zona: "todas", q: "" }); }}
              className="min-h-[44px] text-[14px] font-semibold text-marca-700 hover:text-marca-800">
              Quitar filtros
            </button>
          )}
        </div>
        {truncado && (
          <p className="mb-2 text-[13px] text-[#7A4E00] bg-[#FBF0D5] rounded-lg px-3 py-2">El período tiene demasiados pedidos: se muestran los más recientes. Acorta las fechas.</p>
        )}

        {filas.length === 0 ? (
          <div className="bg-white border border-dashed border-[#D9D6CF] rounded-xl px-6 py-10 text-center">
            <p className="text-[16px] font-semibold text-navy-950">No hay pedidos {hayFiltros ? "con estos filtros" : "en estas fechas"}.</p>
            <p className="mt-1 text-[14px] text-[#5F5E5A]">
              {hayFiltros ? "Prueba quitando filtros o buscando con menos letras." : "Cambia el período para ver ventas anteriores."}
            </p>
            {!hayFiltros && periodo.preset !== "mes" && (
              <button type="button" onClick={() => ir({ periodo: "mes" })} className="mt-4 min-h-[44px] px-5 rounded-lg bg-navy-950 text-white text-[15px] font-semibold">
                Ver este mes
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Celular: filas tocables */}
            <ul className="md:hidden bg-white border border-[#E6E4DF] rounded-xl divide-y divide-[#EFEDE8] overflow-hidden">
              {filas.map((p) => {
                const tono = TONO_ESTADO[p.estado];
                return (
                  <li key={p.numero} className={tono === "urgente" ? "bg-marca-50/70" : ""}>
                    <Link href={`/admin/ventas/${p.numero}`} className="block px-4 py-3.5 active:bg-black/[0.03]">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[16px] font-semibold text-[#111111]">{p.nombre}</span>
                        <span className={`cifra shrink-0 text-[22px] leading-none font-semibold ${tono === "cerrado" ? "text-[#8A8884] line-through decoration-1" : "text-navy-950"}`}>{formatCLP(p.total)}</span>
                      </span>
                      <span className="mt-1 block text-[13px] text-[#5F5E5A] truncate">
                        <span className="font-[var(--font-mono)] text-[12.5px] text-[#2B2A28]">{p.numero}</span> · {fechaCorta(p.created_at)}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <EstadoChip estado={p.estado} />
                        {p.devolucionPendiente && <span className="text-[12px] font-semibold text-[#7A4E00] bg-[#FFF4DB] rounded px-1.5 py-0.5">Devolución pendiente</span>}
                        <span className="text-[13px] text-[#5F5E5A]">{p.cierre ? `${p.cierre} · ` : ""}{medioPago(p.metodo_pago)} · {textoEntrega(p)}</span>
                        {p.factura && <span className="text-[12px] font-semibold text-navy-800 bg-[#E8EDF5] rounded px-1.5 py-0.5">Factura</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Computador: tabla */}
            <div className="hidden md:block bg-white border border-[#E6E4DF] rounded-xl overflow-hidden">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-[0.08em] text-[#6B6A66] border-b border-[#E6E4DF] bg-[#F7F6F3]">
                    <th scope="col" className="font-semibold px-4 py-3">Estado</th>
                    <th scope="col" className="font-semibold px-3 py-3">Pedido</th>
                    <th scope="col" className="font-semibold px-3 py-3">Cliente</th>
                    <th scope="col" className="font-semibold px-3 py-3">Entrega</th>
                    <th scope="col" className="font-semibold px-3 py-3">Pago</th>
                    <th scope="col" className="font-semibold px-3 py-3">Documento</th>
                    <th scope="col" className="font-semibold px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEDE8]">
                  {filas.map((p) => {
                    const tono = TONO_ESTADO[p.estado];
                    return (
                      <tr
                        key={p.numero}
                        onClick={() => router.push(`/admin/ventas/${p.numero}`)}
                        className={`cursor-pointer transition-colors ${tono === "urgente" ? "bg-marca-50/70 hover:bg-marca-50" : "hover:bg-[#F7F6F3]"}`}
                      >
                        <td className="px-4 py-3 align-top">
                          <EstadoChip estado={p.estado} />
                          {p.cierre && <span className="block mt-1 text-[12px] text-[#5F5E5A]">{p.cierre}</span>}
                          {p.devolucionPendiente && <span className="block mt-1 text-[12px] font-semibold text-[#7A4E00]">Devolución pendiente</span>}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Link href={`/admin/ventas/${p.numero}`} onClick={(e) => e.stopPropagation()} className="font-[var(--font-mono)] text-[13px] font-medium text-navy-950 hover:underline underline-offset-2">
                            {p.numero}
                          </Link>
                          <span className="block text-[12.5px] text-[#8A8884]">{fechaCorta(p.created_at)}</span>
                        </td>
                        <td className="px-3 py-3 align-top max-w-[240px]">
                          <span className="block truncate font-medium text-[#111111]">{p.nombre}</span>
                          <span className="block truncate text-[12.5px] text-[#8A8884]">{p.telefono}{p.rut ? ` · ${p.rut}` : ""}</span>
                        </td>
                        <td className="px-3 py-3 align-top text-[#2B2A28]">{textoEntrega(p)}</td>
                        <td className="px-3 py-3 align-top text-[#2B2A28]">{medioPago(p.metodo_pago)}</td>
                        <td className="px-3 py-3 align-top">
                          <span className="text-[#2B2A28]">{p.factura ? "Factura" : "Boleta"}</span>
                          <span className={`block text-[12.5px] ${p.documentoSubido ? "text-[#2F5D33]" : "text-[#8A8884]"}`}>{p.documentoSubido ? "Subida" : "Sin subir"}</span>
                        </td>
                        <td className={`px-4 py-3 align-top text-right cifra text-[19px] font-semibold ${tono === "cerrado" ? "text-[#8A8884] line-through decoration-1" : "text-navy-950"}`}>
                          {formatCLP(p.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {puedeExportar && filas.length > 0 && (
          <a href={`/api/admin/ventas/export${qsExport ? `?${qsExport}` : ""}`}
            className="sm:hidden mt-4 flex items-center justify-center gap-2 min-h-[48px] rounded-lg border border-[#D9D6CF] bg-white text-[15px] font-semibold text-navy-950">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
            Descargar Excel ({filas.length})
          </a>
        )}
      </section>
    </div>
  );
}
