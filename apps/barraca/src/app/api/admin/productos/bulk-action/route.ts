import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * POST /api/admin/productos/bulk-action
 *
 * Tier 6 F5: bulk actions sobre N productos seleccionados.
 *
 * Body:
 *   { ids: number[], action: string, payload?: object }
 *
 * Actions:
 *   - activate           → activo = true
 *   - deactivate         → activo = false
 *   - feature            → destacado = true
 *   - unfeature          → destacado = false
 *   - change_category    → categoria_id = payload.categoria_id
 *   - apply_discount     → en_oferta=true + precio_original=precio + precio = precio*(1-pct/100)
 *   - remove_discount    → en_oferta=false + precio_original=null
 *
 * Permiso: barraca_productos.update (activate/deactivate/feature/unfeature/change_category)
 *          + barraca_precios.update (apply_discount/remove_discount).
 *
 * Rate-limit: 10/min para evitar mass-update accidental.
 */

export const runtime = 'nodejs';

const MAX_IDS = 500;

type Action =
  | 'activate'
  | 'deactivate'
  | 'feature'
  | 'unfeature'
  | 'change_category'
  | 'apply_discount'
  | 'remove_discount';

interface ProductoForDiscount {
  id: number;
  precio: number;
  precio_original: number | null;
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const action = String(body?.action || '') as Action;
  const payload = (body?.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<string, unknown>;

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids requerido (array no vacío)' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Máximo ${MAX_IDS} productos por operación` }, { status: 400 });
  }

  // Permiso según action.
  const needsPrecios = action === 'apply_discount' || action === 'remove_discount';
  const permModule = needsPrecios ? 'barraca_precios' : 'barraca_productos';
  const session = await requirePermission(permModule, 'update');
  if (!session) return forbiddenResponse('No tienes permiso para esta acción masiva');

  const ip = getClientIp(request);
  const rl = rateLimit(`bulk-prod:${ip}`, { maxAttempts: 10, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiadas operaciones masivas. Espera un minuto.' },
      { status: 429 },
    );
  }

  try {
    switch (action) {
      case 'activate': {
        const { error } = await supabaseAdmin
          .from('barraca_productos')
          .update({ activo: true })
          .in('id', ids);
        if (error) throw error;
        return NextResponse.json({ ok: true, affected: ids.length });
      }

      case 'deactivate': {
        const { error } = await supabaseAdmin
          .from('barraca_productos')
          .update({ activo: false })
          .in('id', ids);
        if (error) throw error;
        return NextResponse.json({ ok: true, affected: ids.length });
      }

      case 'feature': {
        const { error } = await supabaseAdmin
          .from('barraca_productos')
          .update({ destacado: true })
          .in('id', ids);
        if (error) throw error;
        return NextResponse.json({ ok: true, affected: ids.length });
      }

      case 'unfeature': {
        const { error } = await supabaseAdmin
          .from('barraca_productos')
          .update({ destacado: false })
          .in('id', ids);
        if (error) throw error;
        return NextResponse.json({ ok: true, affected: ids.length });
      }

      case 'change_category': {
        const categoriaId = Number(payload.categoria_id);
        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
          return NextResponse.json({ error: 'payload.categoria_id requerido' }, { status: 400 });
        }
        // Validar que la categoría existe.
        const { data: cat } = await supabaseAdmin
          .from('barraca_categorias')
          .select('id')
          .eq('id', categoriaId)
          .maybeSingle();
        if (!cat) {
          return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
        }
        const { error } = await supabaseAdmin
          .from('barraca_productos')
          .update({ categoria_id: categoriaId })
          .in('id', ids);
        if (error) throw error;
        return NextResponse.json({ ok: true, affected: ids.length });
      }

      case 'apply_discount': {
        const pct = Number(payload.percent);
        if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
          return NextResponse.json(
            { error: 'payload.percent debe estar entre 1 y 99' },
            { status: 400 },
          );
        }
        // Lee precios actuales para calcular nuevo precio. precio_original
        // conserva el precio original (solo se setea la primera vez).
        const { data: productos, error: fetchErr } = await supabaseAdmin
          .from('barraca_productos')
          .select('id, precio, precio_original')
          .in('id', ids);
        if (fetchErr) throw fetchErr;

        const updates = (productos ?? []).map((p: ProductoForDiscount) => {
          const original = p.precio_original ?? p.precio;
          return {
            id: p.id,
            precio: Math.round(original * (1 - pct / 100)),
            precio_original: original,
            en_oferta: true,
          };
        });

        // Updates en paralelo (precios distintos por producto).
        const results = await Promise.all(
          updates.map((u) =>
            supabaseAdmin
              .from('barraca_productos')
              .update({
                precio: u.precio,
                precio_original: u.precio_original,
                en_oferta: u.en_oferta,
              })
              .eq('id', u.id),
          ),
        );
        const failed = results.filter((r) => r.error).length;
        return NextResponse.json({
          ok: true,
          affected: updates.length - failed,
          failed,
        });
      }

      case 'remove_discount': {
        // Restaurar precio_original y limpiar en_oferta.
        const { data: productos, error: fetchErr } = await supabaseAdmin
          .from('barraca_productos')
          .select('id, precio_original')
          .in('id', ids);
        if (fetchErr) throw fetchErr;

        const results = await Promise.all(
          (productos ?? []).map((p: { id: number; precio_original: number | null }) =>
            p.precio_original
              ? supabaseAdmin
                  .from('barraca_productos')
                  .update({
                    precio: p.precio_original,
                    precio_original: null,
                    en_oferta: false,
                  })
                  .eq('id', p.id)
              : supabaseAdmin
                  .from('barraca_productos')
                  .update({ en_oferta: false })
                  .eq('id', p.id),
          ),
        );
        const failed = results.filter((r) => r.error).length;
        return NextResponse.json({
          ok: true,
          affected: (productos?.length ?? 0) - failed,
          failed,
        });
      }

      default:
        return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 });
    }
  } catch (err) {
    console.error('[bulk-action-fail]', { action, ids_count: ids.length, err: String(err) });
    return NextResponse.json({ error: 'Error en operación masiva' }, { status: 500 });
  }
}
