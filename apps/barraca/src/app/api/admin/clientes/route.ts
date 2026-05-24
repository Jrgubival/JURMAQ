import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { escapeOrFilter } from '@jurmaq/shared/sanitize';

/**
 * GET /api/admin/clientes?q=&segmento=
 *
 * Lista de clientes barraca (de barraca_usuarios) con agregados básicos:
 *   - total_cotizaciones, ltv (suma total pagadas), ultima_compra_at
 *   - cotizaciones_pagadas count
 *
 * Segmentos:
 *   - todos
 *   - activos (con al menos 1 cotización pagada)
 *   - nuevos (registrados últimos 30d)
 *   - inactivos (sin compra hace 90+ días pero con compras previas)
 *
 * Tier 4 D4: Customer 360.
 */

export const runtime = 'nodejs';

interface ClienteRow {
  id: number;
  nombre: string | null;
  email: string;
  telefono: string | null;
  empresa: string | null;
  rut: string | null;
  created_at: string;
  activo: boolean;
}

interface CotMin {
  usuario_id: number | null;
  email: string;
  total: number;
  estado: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_clientes', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const segmento = (searchParams.get('segmento') || 'todos').toLowerCase();

  // 1. Trae lista base de usuarios (filtrada por search si corresponde).
  let usuariosQuery = supabaseAdmin
    .from('barraca_usuarios')
    .select('id, nombre, email, telefono, empresa, rut, created_at, activo')
    .order('created_at', { ascending: false })
    .limit(500);

  if (q.length >= 2) {
    // SECURITY (audit fase 2C.1): escapeOrFilter previene .or() injection
    // (coma/paréntesis pueden inyectar filtros adicionales en PostgREST).
    const safe = escapeOrFilter(q.slice(0, 80));
    if (safe) {
      const like = `%${safe}%`;
      usuariosQuery = usuariosQuery.or(
        `nombre.ilike.${like},email.ilike.${like},rut.ilike.${like},empresa.ilike.${like}`,
      );
    }
  }

  const { data: usuariosRaw, error: usuariosErr } = await usuariosQuery;
  if (usuariosErr) {
    console.error('[clientes-list-fail]', usuariosErr);
    return NextResponse.json({ error: 'Error listando clientes' }, { status: 500 });
  }
  const usuarios = (usuariosRaw ?? []) as ClienteRow[];
  if (usuarios.length === 0) {
    return NextResponse.json({ items: [], resumen: { total: 0 } });
  }

  // 2. Trae todas las cotizaciones en 1 sola query y mapea por usuario+email.
  const emails = Array.from(new Set(usuarios.map((u) => u.email.toLowerCase())));
  const userIds = usuarios.map((u) => u.id);

  const { data: cotsRaw } = await supabaseAdmin
    .from('barraca_cotizaciones')
    .select('usuario_id, email, total, estado, created_at')
    .or(`usuario_id.in.(${userIds.join(',')}),email.in.(${emails.map((e) => `"${e}"`).join(',')})`)
    .limit(5000);

  const cots = ((cotsRaw ?? []) as CotMin[]).map((c) => ({
    ...c,
    email: (c.email || '').toLowerCase(),
  }));

  // 3. Agregados por usuario.
  const NOW = Date.now();
  const items = usuarios.map((u) => {
    const userCots = cots.filter(
      (c) => c.usuario_id === u.id || c.email === u.email.toLowerCase(),
    );
    const cotsPagadas = userCots.filter((c) => c.estado === 'pagada');
    const ltv = cotsPagadas.reduce((sum, c) => sum + Number(c.total || 0), 0);
    const ultimaCompra = cotsPagadas
      .map((c) => new Date(c.created_at).getTime())
      .reduce((a, b) => (b > a ? b : a), 0);
    const ultimaCotizacion = userCots
      .map((c) => new Date(c.created_at).getTime())
      .reduce((a, b) => (b > a ? b : a), 0);

    return {
      ...u,
      total_cotizaciones: userCots.length,
      total_pagadas: cotsPagadas.length,
      ltv,
      ultima_compra_at: ultimaCompra > 0 ? new Date(ultimaCompra).toISOString() : null,
      ultima_actividad_at: ultimaCotizacion > 0 ? new Date(ultimaCotizacion).toISOString() : null,
    };
  });

  // 4. Aplicar filtro de segmento.
  const HACE_30D = NOW - 30 * 24 * 3600 * 1000;
  const HACE_90D = NOW - 90 * 24 * 3600 * 1000;

  const filtered = items.filter((c) => {
    if (segmento === 'activos') return c.total_pagadas > 0;
    if (segmento === 'nuevos') return new Date(c.created_at).getTime() >= HACE_30D;
    if (segmento === 'inactivos') {
      return (
        c.total_pagadas > 0 &&
        c.ultima_compra_at &&
        new Date(c.ultima_compra_at).getTime() < HACE_90D
      );
    }
    return true;
  });

  // Ordena por LTV descendente.
  filtered.sort((a, b) => b.ltv - a.ltv);

  const resumen = {
    total: filtered.length,
    ltv_total: filtered.reduce((s, c) => s + c.ltv, 0),
    promedio_ltv:
      filtered.length > 0
        ? Math.round(filtered.reduce((s, c) => s + c.ltv, 0) / filtered.length)
        : 0,
  };

  return NextResponse.json({ items: filtered, resumen });
}
