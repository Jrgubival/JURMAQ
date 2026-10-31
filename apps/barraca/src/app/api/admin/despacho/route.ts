import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { ZONAS_DESPACHO } from '@/lib/despacho/zonas';
import { actualizarZona, leerFilasZonas, PATRON_ID_ZONA, type FilaZona } from '@/lib/despacho/tarifas-db';

/**
 * /api/admin/despacho — tarifas del camión por zona (tabla barraca_zonas_despacho).
 *
 * GET  → todas las zonas (también las apagadas). Si la tabla no existe o
 *        falla, devuelve las constantes de zonas.ts con `editable: false`.
 * PATCH { id, costo?, gratis_desde?, activo? } → cambia sólo esos campos.
 *
 * Son montos que se cobran: permiso de precios (admin y gerente).
 */
export async function GET() {
  const session = await requirePermission('barraca_precios', 'read');
  if (!session) return forbiddenResponse();
  try {
    const filas = await leerFilasZonas();
    if (filas.length > 0) return NextResponse.json({ editable: true, zonas: filas });
  } catch (error) {
    logSafeError('admin-despacho-leer', { error: String(error) });
  }
  const zonas: FilaZona[] = ZONAS_DESPACHO.map((z, i) => ({
    id: z.id, nombre: z.nombre, comuna: z.comuna, costo: z.costo, gratis_desde: z.gratisDesde, activo: true, orden: i + 1,
  }));
  return NextResponse.json({ editable: false, zonas });
}

const monto = z.number().int().min(0).max(10_000_000);
const schema = z
  .object({
    id: z.string().regex(PATRON_ID_ZONA),
    costo: monto.optional(),
    gratis_desde: z.number().int().min(1).max(10_000_000).nullable().optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.costo !== undefined || d.gratis_desde !== undefined || d.activo !== undefined, { message: 'Sin cambios' });

export async function PATCH(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_precios', 'update');
  if (!session) return forbiddenResponse();

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Revisa los montos: deben ser números enteros, sin puntos.' }, { status: 400 });
  const { id, ...cambio } = parsed.data;
  const por = session.user?.id ?? null;

  try {
    const fila = await actualizarZona(id, cambio, por);
    if (!fila) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
    logSafe('admin-despacho-tarifa', { zona: id, ...cambio, por });
    return NextResponse.json({ ok: true, zona: fila });
  } catch (error) {
    logSafeError('admin-despacho-guardar', { zona: id, error: String(error) });
    return NextResponse.json({ error: 'No se pudo guardar. ¿Está creada la tabla de tarifas?' }, { status: 500 });
  }
}
