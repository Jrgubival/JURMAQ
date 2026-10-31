import 'server-only';
import { env } from '@jurmaq/shared/env';
import { transporter, renderEmailLayout, renderOrderItems, renderButton, escapeHtml, formatCLP } from '@jurmaq/shared/mail/email';
import { textoCombo } from '@/lib/combos';
import { avisosBarraca } from '@jurmaq/shared/mail/barraca';
import { logSafeError } from '@jurmaq/shared/logging';
import { HORARIO_BARRACA } from '@jurmaq/shared/seo';
import { montoDespacho, textoDespacho } from '@/lib/despacho/texto';
import { ETIQUETA_ESTADO, MOTIVOS_CANCELACION, MOTIVOS_RECHAZO, type DocumentoTributario, type Pedido } from './index';
import { urlVerPedido, urlOpinar } from './enlace';
import { MIME_COMPROBANTE, type TipoComprobante } from './comprobantes';

/**
 * Correos de la tienda: confirmación al comprador y aviso a la barraca. Si
 * Resend falla el pedido igual queda guardado; el correo nunca bloquea la
 * compra.
 *
 * Todos los correos al comprador llevan el botón "Ver tu pedido" con su
 * enlace de acceso (lib/pedidos/enlace.ts): no hay cuentas de cliente.
 * Van con skipAdminBcc: la barraca recibe su propio aviso con los datos.
 */

/** En pruebas locales (pedidos en archivo) no se mandan correos reales. */
function modoPrueba(): boolean {
  return env.PEDIDOS_STORE === 'archivo';
}

/**
 * Pruebas locales: en vez de mandar, deja el correo en .correos-dev/ para
 * revisarlo en el navegador. El modo archivo no existe en producción.
 */
async function enviarOGuardar(nombre: string, correo: Parameters<typeof transporter.sendMail>[0]) {
  if (!modoPrueba()) {
    await transporter.sendMail(correo);
    return;
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return;
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.join(process.cwd(), '.correos-dev');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${nombre.replace(/[^A-Za-z0-9-]/g, '_')}.html`), String(correo.html ?? ''));
}

/**
 * Cuenta para transferencias (datos que entregó Jorge el 30-10-2026). Se
 * muestran a todo comprador, así que no son secretos; las variables BANK_*
 * sólo sirven para cambiarlos sin tocar el código.
 */
export function datosTransferencia() {
  return {
    banco: env.BANK_NAME?.trim() || 'BancoEstado',
    tipo: env.BANK_ACCOUNT_TYPE?.trim() || 'Cuenta Corriente',
    cuenta: env.BANK_ACCOUNT?.trim() || '42500240045',
    titular: env.BANK_HOLDER?.trim() || 'Barraca de Fierros JURMAQ SpA',
    rut: env.BANK_RUT?.trim() || '77.722.788-2',
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
  if (p.metodo_pago === 'transferencia' && p.estado === 'transferencia_informada') {
    return `<p style="margin:0;"><strong>Recibimos tu aviso de transferencia.</strong> Te confirmamos por correo cuando veamos el abono.</p>`;
  }
  if (p.metodo_pago === 'transferencia') {
    const t = datosTransferencia();
    const fila = (k: string, v: string | null) =>
      v ? `<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">${k}</td><td style="padding:3px 0;"><strong>${escapeHtml(v)}</strong></td></tr>` : '';
    return `<p style="margin:0 0 8px;font-size:16px;"><strong>Paga por transferencia: ${formatCLP(p.total)}</strong></p>
<table role="presentation" style="font-size:15px;">${fila('Banco', t.banco)}${fila('Tipo', t.tipo)}${fila('N° de cuenta', t.cuenta)}${fila('Titular', t.titular)}${fila('RUT', t.rut)}${fila('Monto exacto', formatCLP(p.total))}</table>
<p style="margin:12px 0 0;padding:12px 14px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;font-size:15px;color:#111111;">Pon el N° de pedido <strong>${escapeHtml(p.numero)}</strong> en el comentario de la transferencia.</p>
<p style="margin:12px 0 0;font-size:14px;">Cuando transfieras, abre tu pedido y toca <strong>«Ya transferí»</strong> (puedes subir el comprobante). También puedes mandarlo a ${escapeHtml(t.email)}.</p>
<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Cuando veamos la transferencia lo preparamos en 1 a 5 días hábiles y te contactamos por WhatsApp o teléfono para coordinar el retiro o la entrega.</p>`;
  }
  return `<p style="margin:0;">Estado del pago: <strong>${escapeHtml(ETIQUETA_ESTADO[p.estado])}</strong>.</p>`;
}

/** Boleta o factura pedida (y los datos de la empresa si es factura). */
function bloqueDocumento(p: Pedido): string {
  if (p.documento_solicitado !== 'factura') {
    return `<p style="margin:0;font-size:14px;">Documento: <strong>Boleta</strong>.</p>`;
  }
  const fila = (k: string, v: string | null | undefined) =>
    v ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">${k}</td><td style="padding:2px 0;">${escapeHtml(v)}</td></tr>` : '';
  return `<p style="margin:0 0 4px;font-size:14px;">Documento: <strong>Factura</strong></p>
<table role="presentation" style="font-size:14px;">${fila('Razón social', p.factura_razon_social)}${fila('RUT', p.factura_rut)}${fila('Giro', p.factura_giro)}${fila('Dirección', p.factura_direccion)}</table>`;
}

/** Botón con el enlace de acceso al pedido, para cualquier navegador. */
function bloqueVerPedido(p: Pedido): string {
  return `<div style="margin:0 0 16px;">${renderButton({ href: urlVerPedido(p.numero), label: 'Ver tu pedido', color: 'navy' })}</div>
<p style="margin:0 0 16px;color:#6b7280;font-size:12px;">Este enlace es personal: abre tu pedido sin contraseña. No lo reenvíes.</p>`;
}

function cuerpo(p: Pedido, intro: string, conEnlace = true): string {
  return `
<p style="margin:0 0 16px;">${intro}</p>
${renderOrderItems(p.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, subtotal: i.subtotal, nota: i.combo ? textoCombo(i.combo) : null })))}
${p.entrega === 'despacho' ? `<p style="margin:16px 0 0;font-size:14px;">Despacho: ${escapeHtml(montoDespacho(p))}</p>` : ''}
${(p.descuento_transferencia ?? 0) > 0 ? `<p style="margin:8px 0 0;font-size:14px;color:#2F7F4E;">Descuento transferencia: −${formatCLP(p.descuento_transferencia ?? 0)}</p>` : ''}
<p style="margin:16px 0;font-size:16px;"><strong>Total: ${formatCLP(p.total)}</strong> <span style="color:#6b7280;font-size:13px;">IVA incluido${p.entrega === 'despacho' && p.costo_despacho == null ? ' · despacho aparte' : ''}</span></p>
<div style="margin:0 0 16px;">${bloqueEntrega(p)}</div>
<div style="margin:0 0 16px;">${bloqueDocumento(p)}</div>
<div style="margin:0 0 16px;">${bloquePago(p)}</div>
${conEnlace ? bloqueVerPedido(p) : ''}
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
  const destino = avisosBarraca();
  try {
    const titulo = motivo === 'pagado' ? `Pedido PAGADO ${p.numero}` : `Pedido nuevo ${p.numero} (${p.metodo_pago === 'transferencia' ? 'transferencia' : 'pago en línea pendiente'})`;
    const datos = `<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(p.nombre)} · ${escapeHtml(p.telefono)} · ${escapeHtml(p.email)}${p.rut ? ` · RUT ${escapeHtml(p.rut)}` : ''}${p.notas ? `<br>Nota: ${escapeHtml(p.notas)}` : ''}</p>`;
    await transporter.sendMail({
      to: destino,
      subject: `${titulo} · ${formatCLP(p.total)}`,
      html: renderEmailLayout({ title: titulo, bodyHtml: datos + cuerpo(p, `Pedido <strong>${escapeHtml(p.numero)}</strong> desde la tienda web.`, false) }),
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
    : p.reembolso?.medio === 'webpay' && p.reembolso.estado === 'hecho'
      ? `<p style="margin:0 0 12px;">Te devolvemos el <strong>100% de lo pagado (${formatCLP(p.total)}), despacho incluido</strong>. Ya anulamos el cobro en Webpay; el abono aparece en tu tarjeta según los plazos de tu banco.</p>`
      : p.reembolso?.medio === 'webpay'
      ? `<p style="margin:0 0 12px;">Te devolvemos el <strong>100% de lo pagado (${formatCLP(p.total)}), despacho incluido</strong>, anulando el cobro en Webpay. Te avisamos cuando esté hecho; el abono aparece en tu tarjeta según los plazos de tu banco.</p>`
      : devolucionTransferencia(p);
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
<div style="margin:0 0 12px;">${renderButton({ href: urlVerPedido(p.numero), label: 'Ver tu pedido', color: 'navy' })}</div>
<p style="margin:0 0 12px;">Si tienes dudas, escríbenos a contacto@jurmaq.cl o al +56 9 7667 3577. También puedes reclamar ante el SERNAC si no estás conforme.</p>
<p style="margin:0;color:#6b7280;font-size:12px;">Términos y Condiciones, sección 8.4: <a href="${URL_TERMINOS}" style="color:#6b7280;">${URL_TERMINOS}</a></p>`,
      }),
      // Copia a la barraca (BCC automático del transporte).
      skipAdminBcc: false,
    });
  } catch (error) {
    logSafeError('pedido-correo-rechazo', { numero: p.numero, error: String(error) });
  }
}

const WHATSAPP_BARRACA = '+56 9 7667 3577';

/** Lo que debe mandar el cliente para devolverle una transferencia (Términos 12.1 y 12.2). */
function devolucionTransferencia(p: Pedido): string {
  return `<p style="margin:0 0 8px;">Te devolvemos el <strong>100% de lo pagado (${formatCLP(p.total)})</strong> por transferencia, a una cuenta de la que seas titular. Respóndenos este correo o escríbenos por WhatsApp al ${WHATSAPP_BARRACA} con:</p>
<ul style="margin:0 0 12px;padding-left:20px;">
<li>Banco</li><li>Tipo de cuenta</li><li>Número de cuenta</li><li>RUT del titular</li><li>Nombre del titular</li>
</ul>
<p style="margin:0 0 12px;">La hacemos lo antes posible y a más tardar dentro de 10 días hábiles desde este aviso (Términos 12.1). Te avisamos por correo cuando esté hecha.</p>`;
}

/** Productos y total del pedido, para los correos de cierre. */
function resumenItems(p: Pedido): string {
  return `${renderOrderItems(p.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, subtotal: i.subtotal, nota: i.combo ? textoCombo(i.combo) : null })))}
<p style="margin:12px 0 16px;font-size:15px;"><strong>Total del pedido: ${formatCLP(p.total)}</strong></p>`;
}

/**
 * Aviso al cliente de que su pedido se canceló: motivo, productos y qué pasa
 * con la plata (no se cobró, transferencia que no llegó, devolución por
 * transferencia o anulación en Webpay). Copia a la barraca.
 */
export async function correoCancelacionComprador(p: Pedido) {
  const motivo = p.cancelacion_motivo;
  const pagado = !!p.pagado_at;
  const nombre = escapeHtml(p.nombre.split(' ')[0]);
  const numero = escapeHtml(p.numero);
  const intro =
    motivo === 'transferencia_no_recibida'
      ? `Hola ${nombre}, no recibimos el pago de tu pedido <strong>${numero}</strong>, por eso lo anulamos.`
      : motivo === 'vencido'
        ? `Hola ${nombre}, no recibimos la transferencia de tu pedido <strong>${numero}</strong> dentro de 48 horas, así que lo anulamos sin costo para ti (Términos 8.3).`
        : motivo === 'cliente'
          ? `Hola ${nombre}, anulamos tu pedido <strong>${numero}</strong>, como nos pediste.`
          : `Hola ${nombre}, anulamos tu pedido <strong>${numero}</strong>.`;
  const plata = !pagado
    ? motivo === 'transferencia_no_recibida' || motivo === 'vencido'
      ? `<p style="margin:0 0 12px;">No hay nada que devolver. Si crees que sí transferiste, respóndenos este correo o escríbenos por WhatsApp al ${WHATSAPP_BARRACA} con el comprobante y lo revisamos.</p>`
      : '<p style="margin:0 0 12px;">No se cobró nada, así que no tienes que hacer nada más.</p>'
    : p.reembolso?.medio === 'webpay'
      ? `<p style="margin:0 0 12px;">${p.reembolso.estado === 'hecho' ? 'Ya anulamos' : 'Estamos anulando'} el cobro de <strong>${formatCLP(p.total)}</strong> en Webpay. El abono vuelve a la misma tarjeta y el plazo en que lo ves depende de tu banco o emisor.</p>`
      : devolucionTransferencia(p);
  try {
    const titulo = `Anulamos tu pedido ${p.numero}`;
    await enviarOGuardar(`${p.numero}-cancelacion`, {
      to: p.email,
      subject: `${titulo} | Barraca JURMAQ`,
      html: renderEmailLayout({
        title: titulo,
        preheader: pagado ? 'Te devolvemos el 100% de lo pagado' : 'No se cobró nada',
        bodyHtml: `
<p style="margin:0 0 12px;">${intro}</p>
${motivo ? `<p style="margin:0 0 12px;"><strong>Motivo:</strong> ${escapeHtml(MOTIVOS_CANCELACION[motivo])}.</p>` : ''}
${resumenItems(p)}
${plata}
<div style="margin:0 0 12px;">${renderButton({ href: urlVerPedido(p.numero), label: 'Ver tu pedido', color: 'navy' })}</div>
<p style="margin:0 0 12px;">Si tienes dudas, escríbenos a contacto@jurmaq.cl o al ${WHATSAPP_BARRACA}.</p>
<p style="margin:0;color:#6b7280;font-size:12px;">Términos y Condiciones: <a href="${URL_TERMINOS}" style="color:#6b7280;">${URL_TERMINOS}</a></p>`,
      }),
      // Copia a la barraca (BCC automático del transporte).
      skipAdminBcc: false,
    });
  } catch (error) {
    logSafeError('pedido-correo-cancelacion', { numero: p.numero, error: String(error) });
  }
}

/** La barraca marcó en el panel que ya transfirió la devolución. */
export async function correoDevolucionHecha(p: Pedido) {
  const c = p.reembolso?.cuenta;
  const cuenta = c ? `${escapeHtml(c.banco)}, cuenta terminada en ${escapeHtml(c.numero.slice(-4))}` : 'la cuenta que nos indicaste';
  try {
    const titulo = `Te devolvimos el pago del pedido ${p.numero}`;
    await enviarOGuardar(`${p.numero}-devolucion-hecha`, {
      to: p.email,
      subject: `${titulo} | Barraca JURMAQ`,
      html: renderEmailLayout({
        title: titulo,
        preheader: `Transferimos ${formatCLP(p.reembolso?.monto ?? p.total)}`,
        bodyHtml: `
<p style="margin:0 0 12px;">Hola ${escapeHtml(p.nombre.split(' ')[0])}, te transferimos <strong>${formatCLP(p.reembolso?.monto ?? p.total)}</strong> del pedido <strong>${escapeHtml(p.numero)}</strong> a ${cuenta}.</p>
<p style="margin:0 0 12px;">Si no ves el abono, respóndenos este correo o escríbenos por WhatsApp al ${WHATSAPP_BARRACA}.</p>
<p style="margin:0;color:#6b7280;font-size:12px;">Términos y Condiciones, sección 12: <a href="${URL_TERMINOS}" style="color:#6b7280;">${URL_TERMINOS}</a></p>`,
      }),
      skipAdminBcc: false,
    });
  } catch (error) {
    logSafeError('pedido-correo-devolucion-hecha', { numero: p.numero, error: String(error) });
  }
}

/**
 * Pedido entregado: pide la opinión de los productos con un enlace de un solo
 * uso por producto (/opinar/<numero>/<token>). Lo dispara el cron
 * /api/cron/post-purchase una sola vez por pedido y respeta la baja de
 * correos (el cron consulta estaDeBaja antes). Devuelve false si no se envió.
 */
export async function correoPedirOpinion(p: Pedido, urlBajaCorreos: string): Promise<boolean> {
  if (modoPrueba()) return false;
  const nombres = [...new Map(p.items.map((i) => [i.productoId, i.nombre])).values()].slice(0, 5);
  try {
    const titulo = '¿Qué te parecieron tus productos?';
    await transporter.sendMail({
      to: p.email,
      subject: `${titulo} · pedido ${p.numero} | Barraca JURMAQ`,
      html: renderEmailLayout({
        title: titulo,
        preheader: `Cuéntanos cómo te fue con tu pedido ${p.numero}`,
        bodyHtml: `
<p style="margin:0 0 12px;">Hola ${escapeHtml(p.nombre.split(' ')[0])}, ya entregamos tu pedido <strong>${escapeHtml(p.numero)}</strong>.</p>
<p style="margin:0 0 12px;">Si tienes un minuto, califica los productos que compraste. Tu opinión ayuda a otros clientes a elegir:</p>
<ul style="margin:0 0 16px;padding:0 0 0 18px;font-size:14px;line-height:1.6;">${nombres.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
<div style="margin:0 0 16px;">${renderButton({ href: urlOpinar(p.numero), label: 'Dar mi opinión' })}</div>
<p style="margin:0 0 12px;color:#6b7280;font-size:13px;">En la opinión publicada sólo aparece tu nombre y la inicial de tu apellido. Puedes opinar una vez por producto.</p>
<p style="margin:0;color:#6b7280;font-size:12px;">Te escribimos una sola vez por este pedido. <a href="${escapeHtml(urlBajaCorreos)}" style="color:#6b7280;">No quiero recibir más correos como este</a>.</p>`,
      }),
      skipAdminBcc: true,
    });
    return true;
  } catch (error) {
    logSafeError('pedido-correo-opinion', { numero: p.numero, error: String(error) });
    return false;
  }
}

const URL_PANEL = `${(env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl').replace(/\/$/, '')}/admin/ventas`;

export interface AdjuntoComprobante {
  contenido: Buffer;
  tipo: TipoComprobante;
}

/**
 * Arma el aviso "Transferencia informada" para la barraca (sin enviarlo), con
 * el comprobante como ADJUNTO. No hay enlace público al archivo: el botón
 * lleva al panel, que exige sesión. Todo dato del comprador va con escapeHtml.
 */
export function armarCorreoTransferenciaInformada(p: Pedido, adjunto: AdjuntoComprobante | null) {
  const titulo = `Transferencia informada · pedido ${p.numero} · ${formatCLP(p.total)}`;
  const nota = p.comprobante_nota?.trim();
  const bodyHtml = `
<p style="margin:0 0 12px;">El cliente avisa que transfirió el pedido <strong>${escapeHtml(p.numero)}</strong>. Revisa la cartola antes de confirmar el pago.</p>
<table role="presentation" style="font-size:15px;margin:0 0 16px;">
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Pedido</td><td><strong>${escapeHtml(p.numero)}</strong></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Monto exacto</td><td><strong>${formatCLP(p.total)}</strong></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Cliente</td><td>${escapeHtml(p.nombre)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Teléfono</td><td>${escapeHtml(p.telefono)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Nota</td><td>${nota ? escapeHtml(nota) : '<span style="color:#6b7280;">(sin nota)</span>'}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Comprobante</td><td>${adjunto ? 'Adjunto en este correo' : '<span style="color:#6b7280;">No subió comprobante</span>'}</td></tr>
</table>
<div style="margin:0 0 8px;">${renderButton({ href: `${URL_PANEL}/${encodeURIComponent(p.numero)}`, label: 'Abrir el pedido en el panel', color: 'navy' })}</div>`;
  return {
    to: avisosBarraca(),
    subject: titulo,
    html: renderEmailLayout({ title: titulo, bodyHtml }),
    skipAdminBcc: true as const,
    attachments: adjunto
      ? [{ filename: `comprobante-${p.numero}.${adjunto.tipo}`, content: adjunto.contenido, contentType: MIME_COMPROBANTE[adjunto.tipo] }]
      : undefined,
  };
}

/** Envía el aviso a la barraca. Nunca lanza: el aviso ya quedó guardado en el pedido. */
export async function correoTransferenciaInformada(p: Pedido, adjunto: AdjuntoComprobante | null): Promise<'enviado' | 'omitido' | 'error'> {
  const correo = armarCorreoTransferenciaInformada(p, adjunto);
  if (modoPrueba()) return 'omitido';
  try {
    const r = await transporter.sendMail(correo);
    return r.error ? 'error' : 'enviado';
  } catch (error) {
    logSafeError('pedido-correo-transferencia-informada', { numero: p.numero, error: String(error) });
    return 'error';
  }
}

/**
 * Manda al cliente la boleta o factura (PDF adjunto) que subió la barraca en
 * el panel. Plantilla fija; todo dato del pedido va con escapeHtml. Nunca
 * lanza. En pruebas locales no se envía ('omitido').
 */
export function armarCorreoDocumentoTributario(p: Pedido, tipo: DocumentoTributario, pdf: Buffer) {
  const nombreDoc = tipo === 'factura' ? 'factura' : 'boleta';
  const titulo = `Tu ${nombreDoc} del pedido ${p.numero}`;
  const bodyHtml = `
<p style="margin:0 0 12px;">Hola ${escapeHtml(p.nombre.split(' ')[0])}, te adjuntamos la ${nombreDoc} de tu pedido <strong>${escapeHtml(p.numero)}</strong> por <strong>${formatCLP(p.total)}</strong>.</p>
${tipo === 'factura' && p.factura_razon_social ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;">Emitida a ${escapeHtml(p.factura_razon_social)}${p.factura_rut ? ` · RUT ${escapeHtml(p.factura_rut)}` : ''}.</p>` : ''}
<div style="margin:0 0 16px;">${renderButton({ href: urlVerPedido(p.numero), label: 'Ver tu pedido', color: 'navy' })}</div>
<p style="margin:0;color:#6b7280;font-size:12px;">Si algún dato está mal, respóndenos este correo o escríbenos a contacto@jurmaq.cl.</p>`;
  return {
    to: p.email,
    subject: `${titulo} | Barraca JURMAQ`,
    html: renderEmailLayout({ title: titulo, preheader: `${nombreDoc[0].toUpperCase()}${nombreDoc.slice(1)} adjunta en PDF`, bodyHtml }),
    skipAdminBcc: true as const,
    attachments: [{ filename: `${nombreDoc}-${p.numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
  };
}

export async function correoDocumentoTributario(p: Pedido, tipo: DocumentoTributario, pdf: Buffer): Promise<'enviado' | 'omitido' | 'error'> {
  const correo = armarCorreoDocumentoTributario(p, tipo, pdf);
  if (modoPrueba()) return 'omitido';
  try {
    const r = await transporter.sendMail(correo);
    return r.error ? 'error' : 'enviado';
  } catch (error) {
    logSafeError('pedido-correo-documento', { numero: p.numero, error: String(error) });
    return 'error';
  }
}
