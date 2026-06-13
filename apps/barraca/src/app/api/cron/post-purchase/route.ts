import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { sendReviewRequestEmail } from '@jurmaq/shared/mail/templates/review-request';
import { sendReplenishmentEmail } from '@jurmaq/shared/mail/templates/replenishment';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';

/**
 * POST /api/cron/post-purchase
 *
 * Tier 4 D6: envío programado de emails post-compra.
 *
 * Mira cotizaciones barraca con estado 'pagada' y dispara:
 *   - Review request: 7-14 días después de pagada_at, si tiene productos
 *     y NO se envió antes
 *   - Replenishment: 55-75 días después de pagada_at, si NO se envió antes
 *
 * Las ventanas dan flexibilidad para que el cron pueda correr 1 vez al día
 * y aún así captar las cotizaciones que cayeron en ese rango.
 *
 * Auth: header x-cron-secret. Schedule sugerido: 1 vez al día (09:00 AM).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 50;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

interface CotizacionRow {
  id: number;
  email: string;
  nombre: string | null;
  numero: string;
  items: unknown;
  pagada_at: string;
}

function parseItems(raw: unknown): Array<{ nombre?: string; slug?: string; producto_id?: number; id?: number }> {
  if (Array.isArray(raw)) return raw as Array<{ nombre?: string; slug?: string }>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = new Date();
  const stats = {
    review_requests_sent: 0,
    replenishments_sent: 0,
    errors: 0,
  };

  // ---- Review requests: ventana [pagada_at + 7d, pagada_at + 14d] ----
  // Damos 7 días de gracia (no insistir si el cron se cae 1-2 días).
  const reviewWindowStart = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();
  const reviewWindowEnd = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: candidatosReview } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select('id, email, nombre, numero, items, pagada_at')
    .eq('estado', 'pagada')
    .is('review_request_sent_at', null)
    .gte('pagada_at', reviewWindowStart)
    .lte('pagada_at', reviewWindowEnd)
    .not('email', 'is', null)
    .limit(BATCH);

  for (const c of (candidatosReview ?? []) as CotizacionRow[]) {
    try {
      const items = parseItems(c.items);
      // Resolver slugs vía DB si los items no traen slug (estructura legacy).
      const productoIds = items
        .map((it) => Number(it.producto_id ?? it.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      let productos: Array<{ nombre: string; slug: string }> = [];
      if (productoIds.length > 0) {
        const { data: prods } = await supabaseAdmin
          .from('barraca_productos')
          .select('nombre, slug')
          .in('id', productoIds)
          .limit(3);
        productos = (prods ?? []).map((p) => ({
          nombre: String(p.nombre),
          slug: String(p.slug),
        }));
      } else {
        // Fallback: usar nombres de items si no podemos resolver.
        productos = items
          .slice(0, 3)
          .filter((it) => it.nombre && it.slug)
          .map((it) => ({ nombre: String(it.nombre), slug: String(it.slug) }));
      }

      await sendReviewRequestEmail({
        to: c.email,
        nombre: c.nombre || 'Cliente',
        numero: c.numero,
        productos,
      });

      await supabaseAdmin
        .from('barraca_cotizaciones')
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq('id', c.id);

      stats.review_requests_sent++;
    } catch (err) {
      console.error('[post-purchase-review-fail]', { id: c.id, err: String(err) });
      stats.errors++;
    }
  }

  // ---- Replenishment: ventana [pagada_at + 55d, pagada_at + 75d] ----
  const replWindowStart = new Date(now.getTime() - 75 * 24 * 3600 * 1000).toISOString();
  const replWindowEnd = new Date(now.getTime() - 55 * 24 * 3600 * 1000).toISOString();

  const { data: candidatosRepl } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select('id, email, nombre, numero, pagada_at')
    .eq('estado', 'pagada')
    .is('replenishment_sent_at', null)
    .gte('pagada_at', replWindowStart)
    .lte('pagada_at', replWindowEnd)
    .not('email', 'is', null)
    .limit(BATCH);

  for (const c of (candidatosRepl ?? []) as CotizacionRow[]) {
    try {
      await sendReplenishmentEmail({
        to: c.email,
        nombre: c.nombre || 'Cliente',
        numero: c.numero,
      });

      await supabaseAdmin
        .from('barraca_cotizaciones')
        .update({ replenishment_sent_at: new Date().toISOString() })
        .eq('id', c.id);

      stats.replenishments_sent++;
    } catch (err) {
      console.error('[post-purchase-replenish-fail]', { id: c.id, err: String(err) });
      stats.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...stats });
}
