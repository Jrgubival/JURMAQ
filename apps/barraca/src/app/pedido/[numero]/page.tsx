import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "@/components/barraca/Enlace";
import { formatCLP } from "@jurmaq/shared/format";
import { HORARIO_BARRACA } from "@jurmaq/shared/seo";
import { logSafeError } from "@jurmaq/shared/logging";
import { pedidos, PATRON_NUMERO, ETIQUETA_ESTADO, MOTIVOS_RECHAZO, type Pedido } from "@/lib/pedidos";
import { puedeVerPedido } from "@/lib/pedidos/enlace";
import { datosTransferencia } from "@/lib/pedidos/correos";
import { montoDespacho, textoDespacho } from "@/lib/despacho/texto";
import { aplicarEstadoPago, pagoEnLineaDisponible } from "@/lib/pagos";
import { mercadoPago } from "@/lib/pagos/mercadopago";
import AccionesPedido from "./AccionesPedido";
import YaTransferi from "./YaTransferi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido | Barraca JURMAQ",
  robots: { index: false, follow: false },
};

/**
 * Confirmación del pedido. Sólo la ve quien tiene la cookie httpOnly que se
 * dejó al crear el pedido (mismo navegador) o la que deja el enlace "Ver tu
 * pedido" de los correos (/pedido/acceso/<numero>/<token>). El pago con Webpay ya llega
 * confirmado desde /api/pagos/webpay/retorno (?pago=anulado|tiempo|rechazado
 * sólo elige el mensaje; el estado sale siempre del pedido guardado). Para
 * pedidos antiguos de Mercado Pago, ?payment_id=... se consulta a Mercado Pago.
 */

const MOTIVO_PAGO: Record<string, string> = {
  anulado: "Anulaste el pago en Webpay. No se hizo ningún cobro.",
  tiempo: "Se acabó el tiempo para pagar en Webpay. No se hizo ningún cobro.",
  rechazado: "Webpay rechazó el pago. No se hizo ningún cobro.",
  cerrado: "Este pedido ya estaba cerrado cuando se aprobó el pago, así que anulamos el cobro en Webpay. Escríbenos si quieres comprar de nuevo.",
  error: "No pudimos confirmar el pago con Webpay. Si se descontó de tu cuenta, escríbenos antes de pagar de nuevo.",
};

/** Comprobante de Webpay que se guarda al confirmar el pago (lo pide Transbank). */
function Comprobante({ d }: { d: Record<string, unknown> }) {
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  const fecha = texto(d.fecha);
  const filas: Array<[string, string | null]> = [
    ["Orden de compra", texto(d.ordenCompra)],
    ["Monto", typeof d.monto === "number" ? formatCLP(d.monto) : null],
    ["Código de autorización", texto(d.autorizacion)],
    ["Fecha", fecha ? new Date(fecha).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }) : null],
    ["Tipo de pago", texto(d.tipoPago)],
    ["Cuotas", typeof d.cuotas === "number" && d.cuotas > 0 ? String(d.cuotas) : "Sin cuotas"],
    ["Tarjeta", texto(d.tarjeta) ? `**** ${d.tarjeta}` : null],
  ];
  return (
    <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px] bg-[#F7F7F5] border border-[#EAEAEA] rounded-xl p-5">
      <dt className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-[#787774] mb-1">Comprobante Webpay</dt>
      {filas.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#787774]">{k}</dt>
          <dd className="font-semibold text-[#111111] tabular-nums [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { numero } = await params;
  const sp = await searchParams;
  const jar = await cookies();

  let pedido: Pedido | null = null;
  if (PATRON_NUMERO.test(numero)) {
    const p = await pedidos().porNumero(numero);
    if (p && puedeVerPedido((n) => jar.get(n)?.value, p)) pedido = p;
  }

  if (!pedido) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-[#111111] mb-3">No encontramos este pedido</h1>
        <p className="text-[#5A5A57] mb-8">
          Para verlo abre el enlace «Ver tu pedido» del correo que te mandamos al comprar.
          Si tienes dudas, escríbenos a contacto@jurmaq.cl o al +56 9 7667 3577.
        </p>
        <Link href="/categorias" className="inline-flex items-center px-6 py-3 bg-navy-950 text-white text-sm font-medium rounded-lg">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  // Retorno de la pasarela: confirmar el pago consultándolo directamente.
  const pagoId = typeof sp.payment_id === "string" ? sp.payment_id : typeof sp.collection_id === "string" ? sp.collection_id : null;
  if (pagoId && (pedido.estado === "pendiente_pago" || pedido.estado === "pago_rechazado") && pedido.pasarela === "mercadopago") {
    try {
      const estado = await mercadoPago.consultarPago(pagoId);
      if (estado && estado.numero === pedido.numero) {
        await aplicarEstadoPago(estado, "mercadopago");
        pedido = (await pedidos().porNumero(numero)) ?? pedido;
      }
    } catch (error) {
      logSafeError("pedido-retorno-consulta", { numero, error: String(error) });
    }
  }

  const pagado = pedido.estado === "pagado" || ["en_preparacion", "listo_retiro", "despachado", "entregado"].includes(pedido.estado);
  const transferencia = pedido.metodo_pago === "transferencia" && pedido.estado === "pendiente_pago";
  const informada = pedido.metodo_pago === "transferencia" && pedido.estado === "transferencia_informada";
  const rechazado = pedido.estado === "pago_rechazado";
  const esperandoPago = pedido.metodo_pago !== "transferencia" && pedido.estado === "pendiente_pago";
  const motivo = typeof sp.pago === "string" && !pagado ? MOTIVO_PAGO[sp.pago] ?? null : null;
  const detallePago = pedido.pasarela === "webpay" && pedido.pago_detalle ? pedido.pago_detalle : null;
  const t = datosTransferencia();

  const noAprobado = pedido.estado === "rechazado";
  const titulo = noAprobado
    ? "No pudimos aprobar tu pedido"
    : pagado
    ? "¡Gracias! Tu pago está confirmado"
    : transferencia
      ? "Pedido recibido: falta la transferencia"
      : informada
      ? "Recibimos tu aviso de transferencia"
      : rechazado
        ? "El pago no se completó"
        : esperandoPago
          ? "Tu pedido está guardado: falta el pago"
          : ETIQUETA_ESTADO[pedido.estado];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 sm:p-8 mb-5">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${pagado ? "bg-green-100 text-green-700" : (rechazado || noAprobado) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`} aria-hidden="true">
          {pagado ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          ) : (rechazado || noAprobado) ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
        </div>
        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">
          Pedido <span className="tabular-nums">{pedido.numero}</span>
        </p>
        <h1 className="text-[#111111] leading-[1.15] mb-3" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 500, letterSpacing: "-0.01em" }}>
          {titulo}
        </h1>
        <p className="text-[15px] text-[#5A5A57]">
          {noAprobado
            ? `Motivo: ${pedido.rechazo_motivo ? MOTIVOS_RECHAZO[pedido.rechazo_motivo] : "no pudimos cumplirlo"}. ${pedido.pagado_at ? `Te devolvemos el 100% de lo pagado (${formatCLP(pedido.total)}), despacho incluido. Te escribimos al correo con el detalle.` : "No se hizo ningún cobro."}`
            : pagado
            ? `Te mandamos el detalle a ${pedido.email}. Lo preparamos en 1 a 5 días hábiles y te contactamos por WhatsApp o teléfono para coordinar el retiro o la entrega.`
            : transferencia
              ? `Transfiere exactamente ${formatCLP(pedido.total)} a esta cuenta. Cuando lo hagas, toca «Ya transferí». Al ver el abono lo preparamos en 1 a 5 días hábiles y te contactamos para coordinar el retiro o la entrega.`
              : informada
              ? "Recibimos tu aviso de transferencia. Te confirmamos por correo cuando veamos el abono."
              : rechazado
                ? `${motivo ?? "No se hizo ningún cobro."} Puedes intentar de nuevo, con la misma u otra tarjeta. Si prefieres transferir, escríbenos y te mandamos los datos.`
                : esperandoPago
                  ? motivo ?? "Si ya pagaste, la confirmación puede tardar unos minutos: recarga esta página. Si no, puedes pagar ahora."
                  : `Estado: ${ETIQUETA_ESTADO[pedido.estado]}.${sp.pago === "cerrado" ? ` ${MOTIVO_PAGO.cerrado}` : ""}`}
        </p>

        <AccionesPedido
          numero={pedido.numero}
          total={pedido.total}
          pagado={pagado}
          puedeReintentar={(rechazado || esperandoPago) && pagoEnLineaDisponible()}
        />

        {pagado && detallePago && <Comprobante d={detallePago} />}

        {transferencia && (
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] bg-[#F7F7F5] border border-[#EAEAEA] rounded-xl p-5">
            {t.banco && (<><dt className="text-[#787774]">Banco</dt><dd className="font-semibold text-[#111111]">{t.banco}</dd></>)}
            {t.tipo && (<><dt className="text-[#787774]">Tipo</dt><dd className="font-semibold text-[#111111]">{t.tipo}</dd></>)}
            {t.cuenta && (<><dt className="text-[#787774]">N° de cuenta</dt><dd className="font-semibold text-[#111111] tabular-nums">{t.cuenta}</dd></>)}
            <dt className="text-[#787774]">Titular</dt><dd className="font-semibold text-[#111111]">{t.titular}</dd>
            {t.rut && (<><dt className="text-[#787774]">RUT</dt><dd className="font-semibold text-[#111111] tabular-nums">{t.rut}</dd></>)}
            <dt className="text-[#787774]">Monto exacto</dt><dd className="font-extrabold text-navy-950 tabular-nums text-[17px]">{formatCLP(pedido.total)}</dd>
            {!t.cuenta && (
              <dd className="col-span-2 text-[13px] text-[#5A5A57] mt-1">Te mandamos los datos de la cuenta por correo y WhatsApp.</dd>
            )}
          </dl>
        )}
        {transferencia && (
          <>
            <p className="mt-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-[15px] text-[#111111]">
              Pon el N° de pedido <strong className="tabular-nums whitespace-nowrap">{pedido.numero}</strong> en el comentario de la transferencia.
            </p>
            <YaTransferi numero={pedido.numero} correo={t.email} />
          </>
        )}
      </div>

      <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 sm:p-8 mb-5">
        <h2 className="text-[17px] font-semibold text-[#111111] mb-4">Detalle</h2>
        <ul className="divide-y divide-gray-100">
          {pedido.items.map((i) => (
            <li key={i.productoId} className="py-3 flex justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className="block text-[#111111]">{i.nombre}</span>
                <span className="block text-xs text-[#787774] tabular-nums">{i.cantidad} × {formatCLP(i.precio)}</span>
              </span>
              <span className="font-medium tabular-nums shrink-0">{formatCLP(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        {pedido.entrega === "despacho" && (
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3 mt-1">
            <span className="text-[#5A5A57]">Despacho</span>
            <span className="tabular-nums">{montoDespacho(pedido)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline border-t border-gray-200 pt-4 mt-1">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-extrabold text-navy-950 tabular-nums">{formatCLP(pedido.total)}</span>
        </div>
        <p className="text-xs text-[#787774] text-right">IVA incluido{pedido.entrega === "despacho" && pedido.costo_despacho == null ? " · despacho aparte" : ""}</p>
      </div>

      <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6 sm:p-8">
        <h2 className="text-[17px] font-semibold text-[#111111] mb-3">Entrega</h2>
        {pedido.entrega === "retiro" ? (
          <p className="text-[15px] text-[#5A5A57]">
            <strong className="text-[#111111]">Retiro en la barraca</strong>: Av. Poniente 2157, Molina.<br />
            {HORARIO_BARRACA.semana}. {HORARIO_BARRACA.sabado}.
          </p>
        ) : (
          <p className="text-[15px] text-[#5A5A57]">
            <strong className="text-[#111111]">{textoDespacho(pedido).titulo}</strong>: {pedido.direccion}, {pedido.comuna}.<br />
            {textoDespacho(pedido).detalle}
          </p>
        )}
        <p className="mt-4 pt-4 border-t border-gray-100 text-[15px] text-[#5A5A57]">
          {pedido.documento_solicitado === "factura" ? (
            <>
              <strong className="text-[#111111]">Factura</strong> a {pedido.factura_razon_social}
              {pedido.factura_rut ? <> · RUT <span className="tabular-nums">{pedido.factura_rut}</span></> : null}.
              {pedido.factura_giro ? <><br />Giro: {pedido.factura_giro}</> : null}
              {pedido.factura_direccion ? <><br />{pedido.factura_direccion}</> : null}
            </>
          ) : (
            <><strong className="text-[#111111]">Boleta</strong>. Te la mandamos por correo.</>
          )}
        </p>
      </div>

      <div className="text-center mt-8">
        <Link href="/categorias" className="text-sm font-semibold text-marca-600 hover:text-marca-700">Seguir comprando</Link>
      </div>
    </div>
  );
}
