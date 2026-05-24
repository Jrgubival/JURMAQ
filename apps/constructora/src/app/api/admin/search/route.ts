import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { escapeOrFilter } from '@jurmaq/shared/sanitize';

/**
 * GET /api/admin/search?q=...
 *
 * Búsqueda global cross-módulo. Busca en:
 *   - maquinarias (nombre, tipo)
 *   - clientes (nombre, rut, email, empresa)
 *   - cotizaciones_arriendo (numero, cliente_nombre, cliente_email, ubicacion)
 *   - contratos (numero, arrendatario_nombre, arrendatario_rut, arrendatario_email)
 *   - combustible_facturas (folio, proveedor_nombre)
 *
 * Devuelve hasta 5 hits por categoría con enlace al detail.
 *
 * Solo admin/gerente con permiso lectura general.
 */

export const runtime = 'nodejs';

interface SearchHit {
  tipo: 'maquinaria' | 'cliente' | 'cotizacion' | 'contrato' | 'factura_combustible';
  titulo: string;
  subtitulo?: string;
  href: string;
}

export async function GET(request: NextRequest) {
  // Requiere admin con permiso de dashboard (toda la administración tiene esto).
  const session = await requirePermission('dashboard', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [], q });
  }

  // SECURITY (audit fase 2C.1): escapeOrFilter previene .or() injection
  // (coma/paréntesis pueden inyectar filtros adicionales en PostgREST).
  const safe = escapeOrFilter(q.slice(0, 80));
  if (!safe) {
    return NextResponse.json({ hits: [], q });
  }
  const like = `%${safe}%`;

  const [maquinarias, clientes, cotizaciones, contratos, facturas] = await Promise.all([
    supabaseAdmin
      .from('maquinarias')
      .select('id, nombre, tipo, estado')
      .or(`nombre.ilike.${like},tipo.ilike.${like}`)
      .limit(5),
    supabaseAdmin
      .from('clientes')
      .select('id, nombre, rut, email, empresa')
      .or(`nombre.ilike.${like},rut.ilike.${like},email.ilike.${like},empresa.ilike.${like}`)
      .limit(5),
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, cliente_nombre, cliente_email, ubicacion_servicio, estado')
      .or(`numero.ilike.${like},cliente_nombre.ilike.${like},cliente_email.ilike.${like},ubicacion_servicio.ilike.${like}`)
      .limit(5),
    supabaseAdmin
      .from('contratos')
      .select('id, numero, arrendatario_nombre, arrendatario_rut, arrendatario_email, estado')
      .or(`numero.ilike.${like},arrendatario_nombre.ilike.${like},arrendatario_rut.ilike.${like},arrendatario_email.ilike.${like}`)
      .limit(5),
    supabaseAdmin
      .from('combustible_facturas')
      .select('id, folio, proveedor_nombre, fecha, monto_total')
      .or(`folio.ilike.${like},proveedor_nombre.ilike.${like}`)
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  (maquinarias.data ?? []).forEach((m) =>
    hits.push({
      tipo: 'maquinaria',
      titulo: m.nombre as string,
      subtitulo: `${m.tipo} · ${m.estado}`,
      href: `/admin/maquinarias/${m.id}`,
    }),
  );
  (clientes.data ?? []).forEach((c) =>
    hits.push({
      tipo: 'cliente',
      titulo: (c.nombre as string) || (c.empresa as string) || 'Sin nombre',
      subtitulo: [c.rut, c.email].filter(Boolean).join(' · '),
      href: `/admin/clientes/${c.id}`,
    }),
  );
  (cotizaciones.data ?? []).forEach((c) =>
    hits.push({
      tipo: 'cotizacion',
      titulo: `${c.numero} — ${c.cliente_nombre || '—'}`,
      subtitulo: `${c.ubicacion_servicio || ''} · ${c.estado}`,
      href: `/admin/cotizaciones-arriendo/${c.id}`,
    }),
  );
  (contratos.data ?? []).forEach((c) =>
    hits.push({
      tipo: 'contrato',
      titulo: `${c.numero || `#${c.id}`} — ${c.arrendatario_nombre || '—'}`,
      subtitulo: `${c.arrendatario_rut || ''} · ${c.estado}`,
      href: `/admin/contratos/${c.id}`,
    }),
  );
  (facturas.data ?? []).forEach((f) =>
    hits.push({
      tipo: 'factura_combustible',
      titulo: `Factura ${f.folio}`,
      subtitulo: `${f.proveedor_nombre || ''} · ${f.fecha ? new Date(f.fecha as string).toLocaleDateString('es-CL') : ''}`,
      href: `/admin/combustible/${f.id}`,
    }),
  );

  return NextResponse.json({ q, hits });
}
