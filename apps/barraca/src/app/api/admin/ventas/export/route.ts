import { NextRequest, NextResponse } from 'next/server';
import XLSX from 'xlsx';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { consultarVentas } from '@/lib/admin/ventas-servidor';
import { ETIQUETA_ESTADO, medioPago, textoEntrega } from '@/lib/admin/ventas';
import { rutaDocumentoValida } from '@/lib/pedidos/documentos';
import type { Pedido } from '@/lib/pedidos';

/**
 * GET /api/admin/ventas/export?… (mismos filtros que la lista) — Excel de las
 * ventas filtradas. Sólo datos del pedido: nunca tokens, hashes ni rutas de
 * archivos privados.
 */

const fecha = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/**
 * Las celdas van como texto (no fórmulas), pero si alguien copia la planilla a
 * CSV, "=…" o "@…" se ejecutarían: se neutralizan. Un teléfono "+56 9…" queda igual.
 */
function celda(v: string | null | undefined): string {
  const s = String(v ?? '');
  return /^[=@\t\r]|^[+-](?![\d\s()]+$)/.test(s) ? `'${s}` : s;
}

function documento(p: Pedido): string {
  if (p.documento_solicitado !== 'factura') return 'Boleta';
  return ['Factura', p.factura_razon_social, p.factura_rut && `RUT ${p.factura_rut}`, p.factura_giro && `Giro ${p.factura_giro}`, p.factura_direccion]
    .filter(Boolean)
    .join(' · ');
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_ventas', 'export');
  if (!session) return forbiddenResponse('No tienes permiso para exportar las ventas');
  try {
    const r = await consultarVentas(request.nextUrl.searchParams);
    const filas = r.pedidos.map((p) => ({
      Fecha: fecha.format(new Date(p.created_at)),
      'N° pedido': p.numero,
      Estado: ETIQUETA_ESTADO[p.estado] ?? p.estado,
      Cliente: celda(p.nombre),
      RUT: celda(p.rut),
      Correo: celda(p.email),
      'Teléfono': celda(p.telefono),
      'Entrega / zona': celda(textoEntrega(p)),
      'Medio de pago': medioPago(p.metodo_pago),
      Subtotal: p.subtotal,
      Despacho: p.entrega === 'despacho' ? (p.costo_despacho ?? 'A coordinar') : 0,
      Total: p.total,
      'Documento tributario': celda(documento(p)),
      'Boleta/factura subida': rutaDocumentoValida(p.documento_path, p.numero) ? 'Sí' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = [16, 16, 22, 28, 14, 30, 16, 22, 14, 12, 12, 12, 60, 12].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    logSafe('admin-ventas-export', { filas: filas.length, desde: r.periodo.desde, hasta: r.periodo.hasta, por: session.user?.id ?? null });
    const nombre = `ventas-barraca-${r.periodo.desde}_${r.periodo.hasta}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logSafeError('admin-ventas-export-error', { error: String(error) });
    return NextResponse.json({ error: 'No se pudo generar el Excel' }, { status: 500 });
  }
}
