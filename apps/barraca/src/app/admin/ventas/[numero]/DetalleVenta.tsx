"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCLP } from "@jurmaq/shared/format";
import { textoCombo } from "@/lib/combos";
import type { FilaVenta } from "@/lib/admin/ventas-servidor";
import type { EstadoPedido, EventoPedido } from "@/lib/pedidos";
import { ESTADOS_VENTA, ETIQUETA_ESTADO, fechaCorta, medioPago } from "@/lib/admin/ventas";
import { MOTIVOS_RECHAZO, type MotivoRechazo } from "@/lib/pedidos/motivos";
import { montoDespacho, nombreCourier } from "@/lib/despacho/texto";
import { linkWhatsappPedido } from "@/lib/admin/whatsapp";
import EstadoChip from "@/components/admin/ventas/EstadoChip";

/**
 * Detalle de una venta: datos del cliente, productos, pago, boleta/factura,
 * historial y acciones. Cada acción llama a su API (que valida permiso y
 * transición en el servidor) y después refresca la página del servidor.
 */

interface Props {
  pedido: FilaVenta;
  eventos: EventoPedido[];
  tieneComprobante: boolean;
  tieneDocumento: boolean;
  puedeEditar: boolean;
  puedeReembolsar: boolean;
}

/** Siguientes pasos razonables (el servidor vuelve a validarlos). */
function acciones(p: FilaVenta): Array<{ estado: EstadoPedido; label: string; principal?: boolean }> {
  switch (p.estado) {
    case "pendiente_pago":
    case "pago_rechazado":
      return [
        ...(p.metodo_pago === "transferencia" ? [{ estado: "pagado" as EstadoPedido, label: "Marcar pagado: llegó la transferencia", principal: true }] : []),
        { estado: "cancelado", label: "Cancelar pedido" },
      ];
    case "transferencia_informada":
      return [
        { estado: "pagado", label: "Confirmar pago: vi el abono", principal: true },
        { estado: "cancelado", label: "Cancelar pedido" },
      ];
    case "pago_discrepancia":
      // Se cobró un monto distinto: se cierra sólo con "No aprobar" + devolución (administrador).
      return [];
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

/** Qué está esperando el pedido, en una frase. */
function siguientePaso(p: FilaVenta): string | null {
  switch (p.estado) {
    case "transferencia_informada": return `El cliente avisó que transfirió. Revisa en la cartola un abono de ${formatCLP(p.total)} con el comentario ${p.numero}.`;
    case "pendiente_pago": return p.metodo_pago === "transferencia" ? "Esperando la transferencia del cliente." : "El cliente no terminó de pagar en Webpay.";
    case "pago_rechazado": return "Webpay rechazó el pago. El cliente puede reintentar desde su pedido.";
    case "pago_discrepancia": return "El monto pagado no calza con el pedido. Revísalo en Transbank antes de seguir.";
    case "pagado": return "Pagado. Toca empezar a preparar.";
    case "en_preparacion": return p.entrega === "retiro" ? "En preparación. Avísale al cliente cuando esté listo." : "En preparación. Coordina el despacho con el cliente.";
    case "listo_retiro": return "Esperando que el cliente lo retire.";
    case "despachado": return "En camino al cliente.";
    default: return null;
  }
}

const RECHAZABLE: EstadoPedido[] = ["pendiente_pago", "transferencia_informada", "pago_rechazado", "pago_discrepancia", "pagado", "en_preparacion", "listo_retiro"];

const fmtLarga = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
/** "31 oct 2026, 09:02" en hora de Chile. */
const fechaLarga = (s: string | null | undefined) => (s ? fmtLarga.format(new Date(s)).replace(".", "") : "");

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  const id = `sec-${titulo.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="bg-white border border-[#E6E4DF] rounded-xl">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 min-h-[48px] border-b border-[#EFEDE8]">
        <h2 id={id} className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#5F5E5A]">{titulo}</h2>
        {accion}
      </div>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  );
}

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[13.5px] text-[#6B6A66] pt-0.5">{k}</dt>
      <dd className="text-[15px] text-[#111111] break-words min-w-0">{children}</dd>
    </>
  );
}

const btn = "inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-lg text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Historial: eventos guardados, o reconstruido con las fechas del pedido si es antiguo. */
function historial(p: FilaVenta, eventos: EventoPedido[]): Array<{ cuando: string; titulo: string; detalle: string | null; quien: string }> {
  const motivoTexto = (m: string | null) => (m && m in MOTIVOS_RECHAZO ? MOTIVOS_RECHAZO[m as MotivoRechazo] : m);
  if (eventos.length > 0) {
    return eventos.map((e) => ({
      cuando: e.created_at,
      titulo: e.estado_anterior == null
        ? "Pedido creado"
        : e.estado_anterior === e.estado_nuevo ? motivoTexto(e.motivo) ?? "Nota" : ETIQUETA_ESTADO[e.estado_nuevo] ?? e.estado_nuevo,
      detalle: e.estado_anterior == null || e.estado_anterior === e.estado_nuevo ? null : motivoTexto(e.motivo),
      quien: e.actor_email
        ?? (e.estado_nuevo === "transferencia_informada" || (e.estado_anterior == null) ? "Cliente" : e.estado_nuevo === "pagado" || e.estado_nuevo === "pago_rechazado" ? "Webpay" : "Sistema"),
    }));
  }
  const h: Array<{ cuando: string; titulo: string; detalle: string | null; quien: string }> = [
    { cuando: p.created_at, titulo: "Pedido creado", detalle: null, quien: "Cliente" },
  ];
  if (p.transferencia_informada_at) h.push({ cuando: p.transferencia_informada_at, titulo: "Transferencia informada", detalle: p.comprobante_nota ?? null, quien: "Cliente" });
  if (p.pagado_at) h.push({ cuando: p.pagado_at, titulo: "Pagado", detalle: null, quien: p.metodo_pago === "transferencia" ? "Panel" : "Webpay" });
  if (p.rechazado_at) h.push({ cuando: p.rechazado_at, titulo: "No aprobado", detalle: motivoTexto(p.rechazo_motivo ?? null), quien: "Panel" });
  if (p.documento_subido_at) h.push({ cuando: p.documento_subido_at, titulo: `${p.documento_tipo === "factura" ? "Factura" : "Boleta"} subida`, detalle: null, quien: "Panel" });
  return h.sort((a, b) => a.cuando.localeCompare(b.cuando));
}

export default function DetalleVenta({ pedido: p, eventos, tieneComprobante, tieneDocumento, puedeEditar, puedeReembolsar }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [rechazo, setRechazo] = useState<{ motivo: MotivoRechazo | ""; nota: string } | null>(null);
  const [docTipo, setDocTipo] = useState<"boleta" | "factura">(p.documento_tipo ?? (p.documento_solicitado === "factura" ? "factura" : "boleta"));
  const [archivo, setArchivo] = useState<File | null>(null);

  const wa = linkWhatsappPedido(p);
  const tel = p.telefono.replace(/[^\d+]/g, "");
  const pasos = acciones(p);
  const paso = siguientePaso(p);
  const pagado = ESTADOS_VENTA.includes(p.estado);
  const factura = p.documento_solicitado === "factura";
  const detallePago = (p.pago_detalle ?? null) as null | {
    ordenCompra?: unknown; autorizacion?: unknown; tarjeta?: unknown; tipoPago?: unknown; cuotas?: unknown; fecha?: unknown; monto?: unknown;
  };
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);

  async function llamar(url: string, init: RequestInit, ok: string) {
    setOcupado(true);
    setAviso(null);
    const res = await fetch(url, init).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setOcupado(false);
    if (!res?.ok) {
      setAviso({ tipo: "error", texto: data.error || (res ? "No se pudo hacer el cambio" : "Sin conexión. Revisa el internet e intenta de nuevo.") });
      return null;
    }
    setAviso({ tipo: "ok", texto: ok });
    router.refresh();
    return data as Record<string, unknown>;
  }

  async function cambiar(estado: EstadoPedido) {
    if (estado === "cancelado" && !confirm(`¿Cancelar el pedido ${p.numero}? Se devuelve el stock y no se puede deshacer.`)) return;
    if (estado === "pagado" && !confirm(`¿Llegó la transferencia de ${formatCLP(p.total)} del pedido ${p.numero}? Revisa la cartola antes. Se le avisa al cliente por correo.`)) return;
    await llamar(`/api/admin/pedidos/${encodeURIComponent(p.numero)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
    }, `Listo: ${ETIQUETA_ESTADO[estado].toLowerCase()}.`);
  }

  async function rechazar() {
    if (!rechazo?.motivo) return;
    const devolucion = !p.pagado_at
      ? "No hubo cobro."
      : p.pasarela === "webpay"
        ? `Se anula el pago en Webpay por ${formatCLP(p.total)} (vuelve solo a la tarjeta).`
        : `Hay que devolver ${formatCLP(p.total)} por transferencia (a mano).`;
    if (!confirm(`¿No aprobar el pedido ${p.numero}?\n\nMotivo: ${MOTIVOS_RECHAZO[rechazo.motivo]}\n${devolucion}\nSe devuelve el stock y se avisa al cliente por correo.`)) return;
    const data = await llamar(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/rechazar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "rechazar", motivo: rechazo.motivo, nota: rechazo.nota.trim() || undefined }),
    }, "Pedido no aprobado. Se avisó al cliente.");
    if (data?.reembolso === "error") setAviso({ tipo: "error", texto: "Quedó no aprobado, pero Webpay no confirmó la anulación. Usa «Reintentar devolución» o revisa el portal de Transbank." });
    if (data) setRechazo(null);
  }

  async function reintentarReembolso() {
    if (!confirm(`¿Anular en Webpay el pago de ${formatCLP(p.total)} del pedido ${p.numero}?`)) return;
    await llamar(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/rechazar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "reembolsar" }),
    }, "Devolución hecha en Webpay.");
  }

  async function generarEnvio(manual: boolean) {
    let seguimiento: string | undefined;
    if (manual) {
      const v = prompt(`N° de seguimiento de ${nombreCourier(p.courier)} para ${p.numero}:`);
      if (!v?.trim()) return;
      seguimiento = v.trim();
    } else if (!confirm(`¿Crear el envío de ${p.numero} en ${nombreCourier(p.courier)}? El courier lo cobra a la cuenta de la barraca.`)) {
      return;
    }
    const data = await llamar(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/envio`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seguimiento ? { seguimiento } : {}),
    }, "Envío guardado.");
    if (typeof data?.etiquetaUrl === "string" && data.etiquetaUrl.startsWith("https://")) window.open(data.etiquetaUrl, "_blank", "noopener");
  }

  async function subirDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) { setAviso({ tipo: "error", texto: "Elige el PDF." }); return; }
    if (archivo.size > 5 * 1024 * 1024) { setAviso({ tipo: "error", texto: "El PDF pesa más de 5 MB." }); return; }
    const nombre = docTipo === "factura" ? "factura" : "boleta";
    if (tieneDocumento && !confirm(`Este pedido ya tiene ${p.documento_tipo === "factura" ? "factura" : "boleta"}. ¿Reemplazarla y mandar la nueva al cliente?`)) return;
    const fd = new FormData();
    fd.set("tipo", docTipo);
    fd.set("archivo", archivo);
    const data = await llamar(`/api/admin/pedidos/${encodeURIComponent(p.numero)}/documento`, { method: "POST", body: fd },
      `${nombre[0].toUpperCase()}${nombre.slice(1)} guardada y enviada a ${p.email}.`);
    if (!data) return;
    setArchivo(null);
    if (data.correo === "omitido") setAviso({ tipo: "ok", texto: `${nombre[0].toUpperCase()}${nombre.slice(1)} guardada. Prueba local: el correo no se envió.` });
    if (data.correo === "error") setAviso({ tipo: "error", texto: `${nombre[0].toUpperCase()}${nombre.slice(1)} guardada, pero el correo no salió. Vuelve a subirla para reintentar.` });
  }

  const lineas = historial(p, eventos);

  return (
    <div className="space-y-4 pb-4">
      <Link href="/admin" className="inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-1 text-[14.5px] font-semibold text-navy-950 hover:text-marca-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 18l-6-6 6-6" /></svg>
        Ventas
      </Link>

      {/* Cabecera: quién, cuánto, en qué está */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-[var(--font-mono)] text-[14px] font-medium text-[#2B2A28]">{p.numero}</span>
            <EstadoChip estado={p.estado} grande />
            {factura && <span className="text-[12.5px] font-semibold text-navy-800 bg-[#E8EDF5] rounded-md px-2 py-1">Pide factura</span>}
          </div>
          <h1 className="mt-2 text-[24px] sm:text-[28px] leading-tight font-semibold text-[#111111] break-words">{p.nombre}</h1>
          <p className="mt-1 text-[14px] text-[#5F5E5A]">{fechaLarga(p.created_at)} · {medioPago(p.metodo_pago)} · {p.entrega === "retiro" ? "Retiro en la barraca" : `Despacho a ${p.comuna ?? "—"}`}</p>
        </div>
        <p className={`cifra shrink-0 text-[44px] sm:text-[52px] leading-none font-semibold ${p.estado === "cancelado" || p.estado === "rechazado" ? "text-[#8A8884] line-through decoration-2" : "text-navy-950"}`}>
          {formatCLP(p.total)}
        </p>
      </header>

      {aviso && (
        <p role={aviso.tipo === "error" ? "alert" : "status"}
          className={`text-[15px] rounded-lg px-4 py-3 ${aviso.tipo === "error" ? "bg-marca-50 text-marca-800 border border-marca-200" : "bg-[#EAF2E8] text-[#2F5D33] border border-[#CFE2CB]"}`}>
          {aviso.texto}
        </p>
      )}

      {/* Qué sigue: la acción principal arriba, al alcance del pulgar */}
      {(paso || pasos.length > 0) && (
        <section aria-label="Qué sigue" className={`rounded-xl p-4 sm:p-5 ${p.estado === "transferencia_informada" || p.estado === "pago_discrepancia" ? "bg-marca-600 text-white" : "bg-navy-950 text-white"} sobre-navy`}>
          {paso && <p className="text-[16px] leading-snug font-medium">{paso}</p>}
          {p.estado === "transferencia_informada" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tieneComprobante ? (
                <a href={`/api/admin/pedidos/${encodeURIComponent(p.numero)}/comprobante`} target="_blank" rel="noopener noreferrer"
                  className={`${btn} bg-white/15 text-white hover:bg-white/25`}>Ver comprobante</a>
              ) : (
                <span className="text-[14px] text-white/85">No subió comprobante.</span>
              )}
              {p.comprobante_nota && <span className="basis-full text-[14px] text-white/90 break-words">Nota del cliente: «{p.comprobante_nota}»</span>}
            </div>
          )}
          {pasos.length > 0 && (
            puedeEditar ? (
              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                {pasos.map((a) => (
                  <button key={a.estado} type="button" disabled={ocupado} onClick={() => cambiar(a.estado)}
                    className={`${btn} ${a.principal ? "bg-white text-navy-950 hover:bg-[#F2F1EE] sm:min-w-[260px]" : "bg-transparent text-white ring-1 ring-inset ring-white/40 hover:bg-white/10"}`}>
                    {ocupado ? "Guardando…" : a.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-white/80">Tu usuario sólo puede mirar este pedido.</p>
            )
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-4 min-w-0">
          <Seccion titulo="Cliente">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#1F7A43] text-white hover:bg-[#19673A]`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0012 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 005.6 1.4h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.3zM12 21.7c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 01-1.5-5.2c0-5.5 4.4-9.9 9.9-9.9 2.6 0 5.1 1 7 2.9a9.8 9.8 0 012.9 7c0 5.5-4.5 9.9-9.9 9.9zm5.4-7.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 01-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.8 2.5.8 3.4.7.6-.1 1.8-.7 2-1.4s.3-1.3.2-1.4l-.4-.1z" /></svg>
                  WhatsApp
                </a>
              ) : (
                <span className={`${btn} bg-[#F0EEE9] text-[#8A8884] text-[13.5px]`}>Sin WhatsApp</span>
              )}
              <a href={`tel:${tel}`} className={`${btn} bg-white text-navy-950 ring-1 ring-inset ring-[#D9D6CF] hover:ring-navy-950`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.3a1 1 0 01.9.7l1.5 4.5a1 1 0 01-.5 1.2l-2.3 1.1a11 11 0 005.5 5.5l1.1-2.3a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.9V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z" /></svg>
                Llamar
              </a>
            </div>
            <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
              <Dato k="Nombre">{p.nombre}</Dato>
              <Dato k="RUT">{p.rut ? <span className="tabular-nums">{p.rut}</span> : <span className="text-[#8A8884]">No lo dio</span>}</Dato>
              <Dato k="Teléfono"><a href={`tel:${tel}`} className="inline-block py-3 -my-3 tabular-nums underline decoration-[#D9D6CF] underline-offset-4 hover:decoration-navy-950">{p.telefono}</a></Dato>
              <Dato k="Correo"><a href={`mailto:${p.email}`} className="inline-block py-3 -my-3 break-all underline decoration-[#D9D6CF] underline-offset-4 hover:decoration-navy-950">{p.email}</a></Dato>
              {p.notas && <Dato k="Comentario">«{p.notas}»</Dato>}
            </dl>
          </Seccion>

          <Seccion titulo="Productos">
            <ul className="divide-y divide-[#EFEDE8] -my-2">
              {p.items.map((i) => (
                <li key={`${i.productoId}-${i.codigo}`} className="flex items-start gap-3 py-2.5">
                  <span className="cifra w-10 shrink-0 text-[20px] leading-tight font-semibold text-navy-950 text-right">{i.cantidad}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] text-[#111111] leading-snug">{i.nombre}</span>
                    <span className="block text-[12.5px] text-[#8A8884]">{[i.codigo && `Cód. ${i.codigo}`, `${formatCLP(i.precio)} c/u`, i.combo && textoCombo(i.combo)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-medium tabular-nums text-[#111111]">{formatCLP(i.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 pt-3 border-t border-[#E6E4DF] space-y-1.5 text-[15px]">
              <div className="flex justify-between"><dt className="text-[#5F5E5A]">Productos</dt><dd className="tabular-nums">{formatCLP(p.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#5F5E5A]">{p.entrega === "retiro" ? "Retiro" : "Despacho"}</dt><dd className="tabular-nums">{p.entrega === "retiro" ? "Gratis" : montoDespacho(p)}</dd></div>
              <div className="flex justify-between items-baseline pt-2"><dt className="font-semibold">Total</dt><dd className="cifra text-[28px] leading-none font-semibold text-navy-950">{formatCLP(p.total)}</dd></div>
            </dl>
          </Seccion>

          <Seccion titulo="Entrega">
            {p.entrega === "retiro" ? (
              <p className="text-[15px]">Retira en la barraca (Av. Poniente 2157, Molina).</p>
            ) : (
              <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
                <Dato k="Dirección">{p.direccion}</Dato>
                <Dato k="Zona">{p.comuna ?? "—"}</Dato>
                <Dato k="Cómo">{p.despacho_tipo === "courier" ? `Courier (${nombreCourier(p.courier)})` : "Despacho a domicilio"}</Dato>
                <Dato k="Cobrado">{montoDespacho(p)}</Dato>
                {p.courier_seguimiento && <Dato k="Seguimiento"><span className="font-[var(--font-mono)] text-[14px]">{p.courier_seguimiento}</span></Dato>}
              </dl>
            )}
            {p.courier_etiqueta_url?.startsWith("https://") && (
              <a className={`${btn} mt-3 w-full bg-white text-navy-950 ring-1 ring-inset ring-[#D9D6CF]`} href={p.courier_etiqueta_url} target="_blank" rel="noopener noreferrer">Imprimir etiqueta (PDF)</a>
            )}
            {puedeEditar && p.despacho_tipo === "courier" && !p.courier_seguimiento && (p.estado === "pagado" || p.estado === "en_preparacion") && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={ocupado} onClick={() => generarEnvio(false)} className={`${btn} bg-navy-950 text-white`}>Generar envío {nombreCourier(p.courier)}</button>
                <button type="button" disabled={ocupado} onClick={() => generarEnvio(true)} className={`${btn} bg-white text-navy-950 ring-1 ring-inset ring-[#D9D6CF]`}>Ingresar seguimiento a mano</button>
              </div>
            )}
          </Seccion>
        </div>

        <div className="space-y-4 min-w-0">
          <Seccion titulo="Pago">
            <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
              <Dato k="Medio">{medioPago(p.metodo_pago)}</Dato>
              <Dato k="Estado">{p.pagado_at ? `Pagado el ${fechaLarga(p.pagado_at)}` : "Sin pagar"}</Dato>
              {detallePago && p.metodo_pago !== "transferencia" && (
                <>
                  {str(detallePago.ordenCompra) && <Dato k="Orden"><span className="font-[var(--font-mono)] text-[13.5px] break-all">{str(detallePago.ordenCompra)}</span></Dato>}
                  {str(detallePago.autorizacion) && <Dato k="Autorización"><span className="tabular-nums">{str(detallePago.autorizacion)}</span></Dato>}
                  {str(detallePago.tarjeta) && <Dato k="Tarjeta"><span className="tabular-nums">•••• {str(detallePago.tarjeta)}</span></Dato>}
                  {str(detallePago.tipoPago) && <Dato k="Tipo">{str(detallePago.tipoPago)}</Dato>}
                  {typeof detallePago.monto === "number" && <Dato k="Monto"><span className="tabular-nums">{formatCLP(detallePago.monto)}</span></Dato>}
                </>
              )}
              {p.metodo_pago === "transferencia" && p.transferencia_informada_at && (
                <Dato k="Aviso">Transfirió el {fechaLarga(p.transferencia_informada_at)}</Dato>
              )}
            </dl>
            {p.metodo_pago === "transferencia" && p.transferencia_informada_at && (
              tieneComprobante ? (
                <a href={`/api/admin/pedidos/${encodeURIComponent(p.numero)}/comprobante`} target="_blank" rel="noopener noreferrer"
                  className={`${btn} mt-3 w-full bg-white text-navy-950 ring-1 ring-inset ring-[#D9D6CF] hover:ring-navy-950`}>Ver comprobante</a>
              ) : (
                <p className="mt-3 text-[13.5px] text-[#8A8884]">No subió comprobante.</p>
              )
            )}
            {p.reembolso && (
              <p className="mt-3 text-[14px] rounded-lg bg-[#F7F6F3] px-3 py-2">
                Devolución {p.reembolso.medio === "webpay" ? "Webpay" : "por transferencia"} de <span className="tabular-nums">{formatCLP(p.reembolso.monto)}</span>:{" "}
                <strong>{p.reembolso.estado === "hecho" ? "hecha" : p.reembolso.estado === "pendiente" ? "pendiente (hacerla a mano)" : p.reembolso.estado === "en_curso" ? "en curso" : "falló"}</strong>
              </p>
            )}
            {p.reembolso?.medio === "webpay" && p.reembolso.estado === "error" && (
              <button type="button" disabled={ocupado || !puedeReembolsar} onClick={reintentarReembolso} className={`${btn} mt-2 w-full bg-marca-600 text-white hover:bg-marca-700`}>
                {puedeReembolsar ? "Reintentar devolución en Webpay" : "Reintentar devolución · solo administrador"}
              </button>
            )}
          </Seccion>

          <Seccion titulo={factura ? "Factura" : "Boleta"}>
            {factura ? (
              <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2.5 mb-4">
                <Dato k="Razón social">{p.factura_razon_social}</Dato>
                <Dato k="RUT"><span className="tabular-nums">{p.factura_rut}</span></Dato>
                <Dato k="Giro">{p.factura_giro}</Dato>
                <Dato k="Dirección">{p.factura_direccion}</Dato>
              </dl>
            ) : (
              <p className="text-[14.5px] text-[#4A4945] mb-4">El cliente pidió boleta.</p>
            )}

            {tieneDocumento && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-[#EAF2E8] px-3 py-2.5">
                <span className="text-[14px] text-[#2F5D33] min-w-0">
                  <strong>{p.documento_tipo === "factura" ? "Factura" : "Boleta"} subida</strong>
                  <span className="block text-[13px]">
                    {p.documento_enviado_at ? `Enviada al cliente el ${fechaLarga(p.documento_enviado_at)}` : "Todavía no se envió por correo"}
                  </span>
                </span>
                <a href={`/api/admin/pedidos/${encodeURIComponent(p.numero)}/documento`} className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-lg bg-white text-[14px] font-semibold text-navy-950 ring-1 ring-inset ring-[#CFE2CB]">
                  Descargar
                </a>
              </div>
            )}

            {!pagado ? (
              <p className="text-[13.5px] text-[#8A8884]">Podrás subir la {factura ? "factura" : "boleta"} cuando el pedido esté pagado.</p>
            ) : !puedeEditar ? null : (
              <form onSubmit={subirDocumento} className="space-y-3">
                <div role="radiogroup" aria-label="Tipo de documento" className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#EFEDE8]">
                  {(["boleta", "factura"] as const).map((t) => (
                    <label key={t} className={`flex items-center justify-center min-h-[44px] rounded-md text-[14.5px] font-semibold cursor-pointer ${docTipo === t ? "bg-white text-navy-950 shadow-[0_1px_2px_rgba(8,20,40,0.12)]" : "text-[#5F5E5A]"}`}>
                      <input type="radio" name="doc-tipo" value={t} checked={docTipo === t} onChange={() => setDocTipo(t)} className="sr-only" />
                      {t === "boleta" ? "Boleta" : "Factura"}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-3 min-h-[52px] px-3 rounded-lg border border-dashed border-[#C9C5BC] bg-[#FBFBFA] cursor-pointer hover:border-navy-950">
                  <svg className="w-6 h-6 shrink-0 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7 3h7l5 5v13H7zM14 3v5h5M12 17v-6m0 0l-2.5 2.5M12 11l2.5 2.5" /></svg>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-navy-950 truncate">{archivo ? archivo.name : "Elegir PDF"}</span>
                    <span className="block text-[12.5px] text-[#8A8884]">{archivo ? `${(archivo.size / 1024).toFixed(0)} KB` : "Sólo PDF, hasta 5 MB"}</span>
                  </span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                </label>
                <button type="submit" disabled={ocupado || !archivo} className={`${btn} w-full bg-navy-950 text-white hover:bg-navy-900`}>
                  {ocupado ? "Subiendo…" : `${tieneDocumento ? "Reemplazar" : "Subir"} ${docTipo} y enviar al cliente`}
                </button>
                <p className="text-[12.5px] text-[#8A8884]">Se manda como adjunto a {p.email}.</p>
              </form>
            )}
          </Seccion>

          <Seccion titulo="Historial">
            <ol className="relative">
              {lineas.map((l, idx) => (
                <li key={`${l.cuando}-${idx}`} className="relative pl-6 pb-4 last:pb-0">
                  {idx < lineas.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-3 bottom-0 w-px bg-[#DCD9D2]" />}
                  <span aria-hidden="true" className={`absolute left-0 top-[5px] w-[11px] h-[11px] rounded-full ring-2 ring-white ${idx === lineas.length - 1 ? "bg-marca-600" : "bg-navy-950"}`} />
                  <p className="text-[14.5px] font-semibold text-[#111111] leading-snug">{l.titulo}</p>
                  {l.detalle && <p className="text-[13.5px] text-[#4A4945] break-words">{l.detalle}</p>}
                  <p className="text-[12.5px] text-[#8A8884]"><span className="tabular-nums">{fechaCorta(l.cuando)}</span> · <span className="break-all">{l.quien}</span></p>
                </li>
              ))}
            </ol>
          </Seccion>

          {p.estado === "rechazado" && (
            <Seccion titulo="No aprobado">
              <p className="text-[15px]">{p.rechazo_motivo ? MOTIVOS_RECHAZO[p.rechazo_motivo] : "—"}</p>
              {p.rechazo_nota && <p className="mt-1 text-[14px] text-[#4A4945]">Nota: {p.rechazo_nota}</p>}
            </Seccion>
          )}

          {RECHAZABLE.includes(p.estado) && (
            <section aria-label="No aprobar" className="rounded-xl border border-marca-200 bg-white px-4 sm:px-5 py-4">
              {!puedeReembolsar ? (
                <>
                  <button type="button" disabled className={`${btn} w-full bg-[#F0EEE9] text-[#8A8884]`}>No aprobar y devolver · solo administrador</button>
                  <p className="mt-2 text-[12.5px] text-[#8A8884]">Devolver dinero lo hace el administrador. Si hay un problema con el pedido, avísale.</p>
                </>
              ) : rechazo == null ? (
                <button type="button" onClick={() => setRechazo({ motivo: "", nota: "" })} className={`${btn} w-full text-marca-700 ring-1 ring-inset ring-marca-200 hover:bg-marca-50`}>
                  No aprobar este pedido…
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[14.5px] text-[#2B2A28]">Sólo por una causa de esta lista (Términos 8.4). Se devuelve el 100% y se avisa al cliente.</p>
                  <label className="block text-[13.5px] text-[#5F5E5A]">Motivo
                    <select value={rechazo.motivo} onChange={(e) => setRechazo({ ...rechazo, motivo: e.target.value as MotivoRechazo })}
                      className="mt-1 w-full min-h-[48px] px-3 rounded-lg border border-[#D9D6CF] bg-white text-[16px] text-[#111111]">
                      <option value="">Elige el motivo</option>
                      {(Object.keys(MOTIVOS_RECHAZO) as MotivoRechazo[]).map((m) => <option key={m} value={m}>{MOTIVOS_RECHAZO[m]}</option>)}
                    </select>
                  </label>
                  <label className="block text-[13.5px] text-[#5F5E5A]">Nota interna (opcional)
                    <input value={rechazo.nota} maxLength={500} onChange={(e) => setRechazo({ ...rechazo, nota: e.target.value })}
                      className="mt-1 w-full min-h-[48px] px-3 rounded-lg border border-[#D9D6CF] bg-white text-[16px] text-[#111111]" />
                  </label>
                  {rechazo.motivo === "sin_despacho" && <p className="text-[13px] text-[#5F5E5A]">Antes, ofrécele retirar en la barraca. El correo también se lo ofrece.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRechazo(null)} className={`${btn} bg-white text-[#2B2A28] ring-1 ring-inset ring-[#D9D6CF]`}>Volver</button>
                    <button type="button" disabled={!rechazo.motivo || ocupado} onClick={rechazar} className={`${btn} bg-marca-600 text-white hover:bg-marca-700`}>No aprobar</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
