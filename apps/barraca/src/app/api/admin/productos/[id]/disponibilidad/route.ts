import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { revalidarCatalogo } from '@/lib/revalidar';
import { esComprable } from '@/lib/stock';
import { precioDeVenta } from '@/lib/precio-web';

/**
 * PATCH /api/admin/productos/[id]/disponibilidad
 *   { disponible: false }            → stock = 0 (regla de la tienda: sin stock = no disponible)
 *   { disponible: true, stock: N }   → stock = N (entero ≥ 1)
 *
 * Escribe SOLO la columna `stock` (whitelist). El precio no se toca acá: si el
 * producto no tiene precio, sigue "no disponible" y se avisa en la respuesta.
 */
const schema = z.discriminatedUnion('disponible', [
  z.object({ disponible: z.literal(false) }).strict(),
  z.object({ disponible: z.literal(true), stock: z.number().int().min(1).max(100_000) }).strict(),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_productos', 'update');
  if (!session) return forbiddenResponse();

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'Indica una cantidad entera mayor que 0' }, { status: 400 });
  const stock = parsed.data.disponible ? parsed.data.stock : 0;

  try {
    const { data: antes, error: errAntes } = await supabaseAdmin
      .from('barraca_productos')
      .select('id, stock')
      .eq('id', id)
      .maybeSingle();
    if (errAntes) throw errAntes;
    if (!antes) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const { data: p, error } = await supabaseAdmin
      .from('barraca_productos')
      .update({ stock })
      .eq('id', id)
      .select('id, precio, precio_original, en_oferta, stock, solo_cotizar, activo')
      .single();
    if (error) throw error;

    logSafe('admin-producto-stock', { productoId: id, antes: antes.stock, despues: stock, por: session.user?.id ?? null });
    revalidarCatalogo();

    const precio = precioDeVenta(p);
    const disponible = esComprable({ precio, stock: p.stock, solo_cotizar: p.solo_cotizar, activo: p.activo });
    return NextResponse.json({
      ok: true,
      stock: p.stock,
      disponible,
      aviso: parsed.data.disponible && !disponible ? 'Se guardó el stock, pero el producto no tiene precio web: sigue como no disponible.' : null,
    });
  } catch (error) {
    logSafeError('admin-producto-stock-error', { productoId: id, error: String(error) });
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}
