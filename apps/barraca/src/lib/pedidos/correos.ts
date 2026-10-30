import 'server-only';
import { env } from '@jurmaq/shared/env';
import { transporter, renderEmailLayout, renderOrderItems, escapeHtml, formatCLP } from '@jurmaq/shared/mail/email';
import { logSafeError } from '@jurmaq/shared/logging';
import { HORARIO_BARRACA } from '@jurmaq/shared/seo';
import { montoDespacho, textoDespacho } from '@/lib/despacho/texto';
import { ETIQUETA_ESTADO, MOTIVOS_RECHAZO, type Pedido } from './index';

/**
 * Correos de la tienda: confirmación al comprador y aviso a la barraca. Si
 * Resend falla el pedido igual queda guardado; el correo nunca bloquea la
 * compra.
 */

/** En pruebas locales (pedidos en archivo) no se mandan correos reales. */
function modoPrueba(): boolean {
  return env.PEDIDOS_STORE === 'archivo';
}

export function datosTransferencia() {
  return {
    banco: env.BANK_NAME?.trim() || null,
    tipo: env.BANK_ACCOUNT_TYPE?.trim() || 'Cuenta corriente',
    cuenta: env.BANK_ACCOUNT?.trim() || null,
    titular: env.BANK_HOLDER?.trim() || 'JURMAQ SpA',
    rut: env.BANK_RUT?.trim() || null,
    email: env.BANK_EMAIL?.trim() || 'contacto@jurmaq.cl',
  };
}

/** Enlace permanente a los Términos: la confirmación escrita del art. 12 A. */
const URL_TERMINOS = 'https://barraca.jurmaq.cl/terminos';

function bloqueEntrega(p: Pedido): string {
  if (p.entrega === 'retiro') {
    return `<p style="margin:0 0 4px;"><strong>Retiro en la barraca</strong>: Av. Poniente 2157, Molina.</p>
<p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(HORARIO_BARRACA.semana)}. ${escapeHtml(HORARIO_BARRACA.sabado)}. Te avisamos cuando esté listo.</p>`;
  }
  const d = textoDespacho(p);
  return `<p style="margin:0 0 4px;"><strong>${escapeHtml(d.titulo)}</strong>: ${escapeHtml(p.direccion || '')}, ${escapeHtml(p.comuna || '')}.</p>
<p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(d.detalle)}</p>`;
}

function bloquePago(p: Pedido): string {
  if (p.estado === 'pagado') {
    const d = p.pago_detalle as { ordenCompra?: unknown; autorizacion?: unknown; tarjeta?: unknown } | null;
    const comprobante =
      p.pasarela === 'webpay' && d && typeof d.ordenCompra === 'string'
        ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Webpay · orden ${escapeHtml(d.ordenCompra)}${typeof d.autorizacion === 'string' ? ` · autorización ${escapeHtml(d.autorizacion)}` : ''}${typeof d.tarjeta === 'string' ? ` · tarjeta **** ${escapeHtml(d.tarjeta)}` : ''}</p>`
        : '';
    return `<p style="margin:0;"><strong>Pago recibido.</strong> Gracias. Lo preparamos en 1 a 5 días hábiles y te contactamos por WhatsApp o teléfono para coordinar el retiro o la entrega.</p>${comprobante}`;
  }
  if (p.metodo_pago === 'transferencia') {
    const t = datosTransferencia();
    const fila = (k: string, v: string | null) =>
      v ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">${k}</td><td style="padding:2px 0;"><strong>${escapeHtml(v)}</strong></td></tr>` : '';
    return `<p style="margin:0 0 8px;"><strong>Paga por transferencia</strong> ${formatCLP(p.total)} indicando el pedido <strong>${escapeHtml(p.numero)}</strong>:</p>
<table role="presentation" style="font-size:14px;">${fila('Banco', t.banco)}${fila('Tipo', t.tipo)}${fila('N° de cuenta', t.cuenta)}${fila('Titular', t.titular)}${fila('RUT', t.rut)}${fila('Comprobante a', t.email)}</table>
<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Cuando veamos la transferencia lo preparamos en 1 a 5 días hábiles y te contactamos por WhatsApp o teléfono para coordinar el retiro o la entrega.</p>`;
  }
  return `<p style="margin:0;">Estado del pago: <strong>${escapeHtml(ETIQUETA_ESTADO[p.estado])}</strong>.</p>`;
}

function cuerpo(p: Pedido, intro: string): string {
  return `
<p style="margin:0 0 16px;">${intro}</p>
${renderOrderItems(p.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })))}
${p.entrega === 'despacho' ? `<p style="margin:16px 0 0;font-size:14px;">Despacho: ${escapeHtml(montoDespacho(p))}</p>` : ''}
<p style="margin:16px 0;font-size:16px;"><strong>Total: ${formatCLP(p.total)}</strong> <span style="color:#6b7280;font-size:13px;">IVA incluido${p.entrega === 'despacho' && p.costo_despacho == null ? ' · despacho aparte' : ''}</span></p>
<div style="margin:0 0 16px;">${bloqueEntrega(p)}</div>
<div style="margin:0 0 16px;">${bloquePago(p)}</div>
<p style="margin:0;color:#6b7280;font-size:12px;">Esta compra se rige por nuestros <a href="${URL_TERMINOS}" style="color:#6b7280;">Términos y Condiciones</a> (${URL_TERMINOS}), que aceptaste al comprar. Puedes guardarlos o imprimirlos desde ese enlace.</p>`;
}

export async function correoConfirmacionComprador(p: Pedido) {
  if (modoPrueba()) return;
  try {
    const titulo = p.estado === 'pagado' ? `Pago recibido · pedido ${p.numero}` : `Recibimos tu pedido ${p.numero}`;
    await transporter.sendMail({
      to: p.email,
      subject: `${titulo} | Barraca JURMAQ`,
      html: renderEmailLayout({
        title: titulo,
        preheader: `Pedido ${p.numero} por ${formatCLP(p.total)}`,
        bodyHtml: cuerpo(p, `Hola ${escapeHtml(p.nombre.split(' ')[0])}, este es el detalle de tu pedido <strong>${escapeHtml(p.numero)}</strong>.`),
      }),
      skipAdminBcc: true,
    });
  } catch (error) {
    logSafeError('pedido-correo-comprador', { numero: p.numero, error: String(error) });
  }
}

export async function correoAvisoBarraca(p: Pedido, motivo: 'nuevo' | 'pagado') {
  if (modoPrueba()) return;
  const destino = env.BARRACA_PEDIDOS_EMAIL || env.ADMIN_EMAIL || 'contacto@jurmaq.cl';
  try {
    const titulo = motivo === 'pagado' ? `Pedido PAGADO ${p.numero}` : `Pedido nuevo ${p.numero} (${p.metodo_pago === 'transferencia' ? 'transferencia' : 'pago en línea pendiente'})`;
    const datos = `<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(p.nombre)} · ${escapeHtml(p.telefono)} · ${escapeHtml(p.email)}${p.rut ? ` · RUT ${escapeHtml(p.rut)}` : ''}${p.notas ? `<br>Nota: ${escapeHtml(p.notas)}` : ''}</p>`;
    await transporter.sendMail({
      to: destino,
      subject: `${titulo} · ${formatCLP(p.total)}`,
      html: renderEmailLayout({ title: titulo, bodyHtml: datos + cuerpo(p, `Pedido <strong>${escapeHtml(p.numero)}</strong> desde la tienda web.`) }),
      skipAdminBcc: true,
    });
  } catch (error) {
    logSafeError('pedido-correo-barraca', { numero: p.numero, error: String(error) });
  }
}

/**
 * Aviso al comprador de que la barraca no aprobó su pedido (Términos 8.4):
 * motivo de la lista cerrada y devolución del 100% de lo pagado, despacho
 * incluido. Plantilla fija: el panel sólo elige el motivo.
 */
export async function correoRechazoComprador(p: Pedido) {
  if (modoPrueba()) return;
  const motivo = p.rechazo_motivo ? MOTIVOS_RECHAZO[p.rechazo_motivo] : 'No pudimos cumplir el pedido';
  const pagado = !!p.pagado_at;
  const devolucion = !pagado
    ? '<p style="margin:0 0 12px;">No se hizo ningún cobro, así que no tienes que hacer nada más.</p>'
    : p.reembolso?.medio === 'webpay'
      ? `<p style="margin:0 0 12px;">Te devolvemos el <strong>100% de lo pagado (${formatCLP(p.total)}), despacho incluido</strong>. Ya pedimos la anulación del cobro en Webpay; el abono aparece en tu tarjeta según los plazos de tu banco.</p>`
      : `<p style="margin:0 0 12px;">Te devolvemos el <strong>100% de lo pagado (${formatCLP(p.total)}), despacho incluido</strong>, por transferencia, dentro de 10 días hábiles. Respóndenos este correo o escríbenos por WhatsApp con tus datos bancarios.</p>`;
  const retiro = p.rechazo_motivo === 'sin_despacho'
    ? '<p style="margin:0 0 12px;">Si te sirve, puedes retirar el pedido en la barraca (Av. Poniente 2157, Molina) en vez de la devolución: respóndenos este correo.</p>'
    : '';
  try {
    const titulo = `No pudimos aprobar tu pedido ${p.numero}`;
    await transporter.sendMail({
      to: p.email,
      subject: `${titulo} | Barraca JURMAQ`,
      html: renderEmailLayout({
        title: titulo,
        preheader: `Te devolvemos el 100% de lo pagado`,
        bodyHtml: `
<p style="margin:0 0 12px;">Hola ${escapeHtml(p.nombre.split(' ')[0])}, lamentamos avisarte que no podemos aprobar tu pedido <strong>${escapeHtml(p.numero)}</strong>.</p>
<p style="margin:0 0 12px;"><strong>Motivo:</strong> ${escapeHtml(motivo)}.</p>
${retiro}${devolucion}
<p style="margin:0 0 12px;">Si tienes dudas, escríbenos a contacto@jurmaq.cl o al +56 9 7667 3577. También puedes reclamar ante el SERNAC si no estás conforme.</p>
<p style="margin:0;color:#6b7280;font-size:12px;">Términos y Condiciones, sección 8.4: <a href="${URL_TERMINOS}" style="color:#6b7280;">${URL_TERMINOS}</a></p>`,
      }),
      skipAdminBcc: true,
    });
  } catch (error) {
    logSafeError('pedido-correo-rechazo', { numero: p.numero, error: String(error) });
  }
}
