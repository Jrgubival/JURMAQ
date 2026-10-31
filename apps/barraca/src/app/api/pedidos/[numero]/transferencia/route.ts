import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { puedeVerPedido } from '@/lib/pedidos/enlace';
import { correoTransferenciaInformada } from '@/lib/pedidos/correos';
import { MAX_COMPROBANTE, detectarTipo, guardarComprobante, borrarComprobante, type TipoComprobante } from '@/lib/pedidos/comprobantes';

/**
 * POST /api/pedidos/[numero]/transferencia — "Ya transferí".
 * multipart/form-data: `comprobante` (opcional: JPG/PNG/WebP/HEIC/PDF, máx.
 * 5 MB, validado por magic bytes) y `nota` (opcional, 300 caracteres).
 *
 * Sólo para quien puede ver el pedido (cookie del checkout o del enlace del
 * correo), nunca por el número solo. Una sola vez por pedido: pasa de
 * 'pendiente_pago' a 'transferencia_informada' con un update condicional.
 */

/** Holgura para los encabezados del multipart y la nota. */
const MAX_CUERPO = MAX_COMPROBANTE + 64 * 1024;

const schema = z.object({
  nota: z.string().trim().max(300).optional(),
});

const noEncontrado = () => NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
const muyGrande = () => NextResponse.json({ error: 'El archivo pesa más de 5 MB. Sube una foto o un PDF más liviano.' }, { status: 413 });

/** Lee el cuerpo cortando apenas pasa el límite (no carga cuerpos enormes en memoria). */
async function leerCuerpo(request: NextRequest): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO) {
      await reader.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const rl = rateLimit(`pedidos-transferencia:${getClientIp(request)}`, { maxAttempts: 10, windowSeconds: 600 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return noEncontrado();

  // Rechazo temprano por tamaño declarado, antes de leer nada.
  const largo = Number(request.headers.get('content-length'));
  if (Number.isFinite(largo) && largo > MAX_CUERPO) return muyGrande();
  const tipoContenido = request.headers.get('content-type') || '';
  if (!tipoContenido.toLowerCase().startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }

  const store = pedidos();
  let pedido;
  try {
    pedido = await store.porNumero(numero);
  } catch (error) {
    logSafeError('pedido-transferencia-leer', { numero, error: String(error) });
    return NextResponse.json({ error: 'No pudimos guardar tu aviso. Intenta de nuevo.' }, { status: 500 });
  }
  if (!pedido || !puedeVerPedido((n) => request.cookies.get(n)?.value, pedido)) return noEncontrado();
  if (pedido.metodo_pago !== 'transferencia') {
    return NextResponse.json({ error: 'Este pedido no es por transferencia' }, { status: 409 });
  }
  if (pedido.estado === 'transferencia_informada') {
    return NextResponse.json({ error: 'Ya nos avisaste; estamos revisando.', yaInformado: true }, { status: 409 });
  }
  if (pedido.estado !== 'pendiente_pago') {
    return NextResponse.json({ error: 'Este pedido ya no está pendiente de pago' }, { status: 409 });
  }

  const cuerpo = await leerCuerpo(request).catch(() => undefined);
  if (cuerpo === null) return muyGrande();
  if (cuerpo === undefined) return NextResponse.json({ error: 'Se cortó la conexión. Intenta de nuevo.' }, { status: 400 });

  let form: FormData;
  try {
    form = await new Response(new Uint8Array(cuerpo), { headers: { 'content-type': tipoContenido } }).formData();
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }

  const notaCampo = form.get('nota');
  const parsed = parseBody(schema, { nota: typeof notaCampo === 'string' && notaCampo.trim() ? notaCampo : undefined });
  if (!parsed.ok) return NextResponse.json({ error: 'La nota puede tener hasta 300 caracteres' }, { status: 400 });
  const nota = parsed.data.nota || null;

  // El archivo es opcional. El nombre y el tipo que manda el navegador no se usan.
  let adjunto: { contenido: Buffer; tipo: TipoComprobante } | null = null;
  const archivo = form.get('comprobante');
  if (archivo !== null && typeof archivo !== 'string' && archivo.size > 0) {
    if (archivo.size > MAX_COMPROBANTE) return muyGrande();
    const contenido = Buffer.from(await archivo.arrayBuffer());
    if (contenido.length > MAX_COMPROBANTE) return muyGrande();
    const tipo = detectarTipo(contenido);
    if (!tipo) {
      return NextResponse.json({ error: 'El archivo debe ser una foto (JPG, PNG, WebP o HEIC) o un PDF.' }, { status: 415 });
    }
    adjunto = { contenido, tipo };
  } else if (archivo !== null && typeof archivo === 'string') {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }

  let ruta: string | null = null;
  try {
    if (adjunto) ruta = await guardarComprobante(numero, adjunto.contenido, adjunto.tipo);
    const ok = await store.informarTransferencia(numero, ruta, nota);
    if (!ok) {
      // Otro clic ganó o el pedido cambió entre medio: no se pisa nada.
      if (ruta) await borrarComprobante(ruta);
      const actual = await store.porNumero(numero);
      return actual?.estado === 'transferencia_informada'
        ? NextResponse.json({ error: 'Ya nos avisaste; estamos revisando.', yaInformado: true }, { status: 409 })
        : NextResponse.json({ error: 'Este pedido ya no está pendiente de pago' }, { status: 409 });
    }
  } catch (error) {
    if (ruta) await borrarComprobante(ruta);
    logSafeError('pedido-transferencia-guardar', { numero, error: String(error) });
    return NextResponse.json({ error: 'No pudimos guardar tu aviso. Intenta de nuevo o mándanos el comprobante a contacto@jurmaq.cl.' }, { status: 500 });
  }

  const actualizado = (await store.porNumero(numero).catch(() => null)) ?? { ...pedido, estado: 'transferencia_informada' as const, comprobante_nota: nota, comprobante_path: ruta };
  const correo = await correoTransferenciaInformada(actualizado, adjunto);
  logSafe('pedido-transferencia-informada', { numero, comprobante: adjunto?.tipo ?? null, bytes: adjunto?.contenido.length ?? 0, nota: !!nota, correo });
  return NextResponse.json({ ok: true });
}
