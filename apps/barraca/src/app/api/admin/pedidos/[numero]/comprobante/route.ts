import { NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { leerComprobante, rutaValida, MIME_COMPROBANTE } from '@/lib/pedidos/comprobantes';

/**
 * GET /api/admin/pedidos/[numero]/comprobante — entrega el comprobante de
 * transferencia que subió el cliente. Sólo panel (mismo permiso que ver los
 * pedidos). El archivo se lee con service_role y se manda en la respuesta:
 * no existe URL pública ni firmada que se pueda reenviar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const session = await requirePermission('barraca_cotizaciones', 'read');
  if (!session) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try {
    const pedido = await pedidos().porNumero(numero);
    const ruta = pedido?.comprobante_path;
    // La ruta guardada debe ser de este mismo pedido.
    if (!pedido || !rutaValida(ruta) || !ruta.startsWith(`${pedido.numero}/`)) {
      return NextResponse.json({ error: 'Este pedido no tiene comprobante' }, { status: 404 });
    }
    const archivo = await leerComprobante(ruta);
    if (!archivo) return NextResponse.json({ error: 'No encontramos el archivo' }, { status: 404 });

    logSafe('admin-pedido-comprobante', { numero, por: session.user?.id ?? null });
    const pdf = archivo.tipo === 'pdf';
    return new NextResponse(new Uint8Array(archivo.contenido), {
      headers: {
        'Content-Type': MIME_COMPROBANTE[archivo.tipo],
        'Content-Length': String(archivo.contenido.length),
        // Las fotos se ven en el navegador; el PDF se descarga (no corre en el origen del panel).
        'Content-Disposition': `${pdf ? 'attachment' : 'inline'}; filename="comprobante-${pedido.numero}.${archivo.tipo}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    logSafeError('admin-pedido-comprobante-error', { numero, error: String(error) });
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 500 });
  }
}
