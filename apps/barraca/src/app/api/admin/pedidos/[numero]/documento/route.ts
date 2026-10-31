import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO, type DocumentoTributario } from '@/lib/pedidos';
import { ESTADOS_VENTA } from '@/lib/admin/ventas';
import { correoDocumentoTributario } from '@/lib/pedidos/correos';
import { MAX_DOCUMENTO, esPdf, guardarDocumento, leerDocumento, borrarDocumento, rutaDocumentoValida } from '@/lib/pedidos/documentos';

/**
 * /api/admin/pedidos/[numero]/documento — boleta o factura del pedido (PDF).
 *
 *   POST multipart/form-data: `archivo` (PDF, magic bytes %PDF, ≤ 5 MB) y
 *     `tipo` ('boleta' | 'factura'). Lo guarda privado, lo manda al cliente
 *     por correo como adjunto y lo registra en el historial. Subir otro
 *     reemplaza al anterior.
 *   GET → entrega el PDF guardado (descarga). Nunca hay URL pública.
 *
 * Sólo pedidos pagados (no se emite boleta de algo sin pagar).
 */

const MAX_CUERPO = MAX_DOCUMENTO + 64 * 1024;
const noEncontrado = () => NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
const muyGrande = () => NextResponse.json({ error: 'El PDF pesa más de 5 MB.' }, { status: 413 });

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
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_ventas', 'update');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return noEncontrado();

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
    logSafeError('admin-documento-leer', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo subir el documento' }, { status: 500 });
  }
  if (!pedido) return noEncontrado();
  if (!ESTADOS_VENTA.includes(pedido.estado)) {
    return NextResponse.json({ error: 'Sube la boleta o factura cuando el pedido esté pagado' }, { status: 409 });
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

  const tipoCampo = form.get('tipo');
  if (tipoCampo !== 'boleta' && tipoCampo !== 'factura') return NextResponse.json({ error: 'Elige boleta o factura' }, { status: 400 });
  const tipo: DocumentoTributario = tipoCampo;

  const archivo = form.get('archivo');
  if (archivo === null || typeof archivo === 'string' || archivo.size === 0) {
    return NextResponse.json({ error: 'Elige el PDF' }, { status: 400 });
  }
  if (archivo.size > MAX_DOCUMENTO) return muyGrande();
  const contenido = Buffer.from(await archivo.arrayBuffer());
  if (contenido.length > MAX_DOCUMENTO) return muyGrande();
  if (!esPdf(contenido)) return NextResponse.json({ error: 'El archivo tiene que ser un PDF.' }, { status: 415 });

  let ruta: string;
  try {
    ruta = await guardarDocumento(numero, contenido);
  } catch (error) {
    logSafeError('admin-documento-guardar', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo guardar el PDF' }, { status: 500 });
  }
  const anterior = pedido.documento_path;
  try {
    await store.guardarDocumento(numero, ruta, tipo);
  } catch (error) {
    await borrarDocumento(ruta);
    logSafeError('admin-documento-pedido', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo guardar el PDF' }, { status: 500 });
  }
  if (anterior && anterior !== ruta) await borrarDocumento(anterior);

  const actualizado = (await store.porNumero(numero)) ?? pedido;
  const correo = await correoDocumentoTributario(actualizado, tipo, contenido);
  if (correo === 'enviado') {
    await store.marcarDocumentoEnviado(numero).catch((e) => logSafeError('admin-documento-enviado', { numero, error: String(e) }));
  }
  const nombre = tipo === 'factura' ? 'Factura' : 'Boleta';
  const motivo = `${nombre} ${anterior ? 'reemplazada' : 'subida'}${correo === 'enviado' ? ' y enviada al cliente' : correo === 'omitido' ? ' (prueba local: correo no enviado)' : ' · el correo no salió'}`;
  await store.registrarEvento(numero, actualizado.estado, session.user?.email ?? null, motivo)
    .catch((e) => logSafeError('admin-documento-evento', { numero, error: String(e) }));

  logSafe('admin-documento-subido', { numero, tipo, correo, reemplazo: !!anterior, por: session.user?.id ?? null });
  return NextResponse.json({ ok: true, correo });
}

export async function GET(_request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return forbiddenResponse();
  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return noEncontrado();
  try {
    const pedido = await pedidos().porNumero(numero);
    const ruta = pedido?.documento_path;
    if (!pedido || !rutaDocumentoValida(ruta, pedido.numero)) {
      return NextResponse.json({ error: 'Este pedido no tiene boleta ni factura' }, { status: 404 });
    }
    const pdf = await leerDocumento(ruta);
    if (!pdf) return NextResponse.json({ error: 'No encontramos el archivo' }, { status: 404 });
    logSafe('admin-documento-ver', { numero, por: session.user?.id ?? null });
    const nombre = `${pedido.documento_tipo === 'factura' ? 'factura' : 'boleta'}-${pedido.numero}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        // Descarga: el PDF no corre en el origen del panel.
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    logSafeError('admin-documento-ver-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 500 });
  }
}
