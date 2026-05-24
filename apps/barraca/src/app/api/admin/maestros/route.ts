import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString, escapeOrFilter } from '@jurmaq/shared/sanitize';

/**
 * GET  /api/admin/maestros — lista paginada con búsqueda
 * POST /api/admin/maestros — crea maestro nuevo (auto-genera código MAE-YYYY-NNN)
 *
 * Tier 2 B1: Programa de Referidos.
 */

export const runtime = 'nodejs';

// Validador RUT mínimo (formato XX.XXX.XXX-X o sin puntos).
function isValidRut(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;
  const cleaned = rut.replace(/[.\s]/g, '').toUpperCase();
  return /^[0-9]{7,8}-[0-9K]$/.test(cleaned);
}

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_maestros', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const activo = searchParams.get('activo'); // 'true' | 'false' | null (todos)

  let query = supabaseAdmin
    .from('maestros')
    .select('id, codigo, nombre, rut, email, telefono, porcentaje_comision, activo, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (activo === 'true') query = query.eq('activo', true);
  else if (activo === 'false') query = query.eq('activo', false);

  if (q.length >= 2) {
    // SECURITY (audit fase 2C.1): escapeOrFilter strip de coma/paréntesis +
    // escape LIKE wildcards. Previene PostgREST filter injection en .or().
    const safe = escapeOrFilter(q.slice(0, 80));
    if (safe) {
      const like = `%${safe}%`;
      query = query.or(`nombre.ilike.${like},codigo.ilike.${like},rut.ilike.${like},email.ilike.${like}`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error('[maestros-list-fail]', error);
    return NextResponse.json({ error: 'Error listando maestros' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_maestros', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const body = await request.json().catch(() => ({}));
  const nombre = sanitizeString(body?.nombre)?.trim() || '';
  const rut = sanitizeString(body?.rut)?.trim() || '';
  if (!nombre || nombre.length < 3) {
    return NextResponse.json({ error: 'Nombre requerido (mín 3 chars)' }, { status: 400 });
  }
  if (!isValidRut(rut)) {
    return NextResponse.json({ error: 'RUT inválido (formato 12345678-9)' }, { status: 400 });
  }

  const porcentaje = body?.porcentaje_comision !== undefined ? Number(body.porcentaje_comision) : 1.0;
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    return NextResponse.json({ error: 'porcentaje_comision debe estar entre 0 y 100' }, { status: 400 });
  }

  // Genera código MAE-YYYY-NNN vía RPC.
  const { data: codigoData, error: codigoErr } = await supabaseAdmin.rpc('next_maestro_codigo');
  if (codigoErr || !codigoData) {
    console.error('[maestros-codigo-fail]', codigoErr);
    return NextResponse.json({ error: 'Error generando código' }, { status: 500 });
  }

  const tipoCuenta = body?.tipo_cuenta;
  const validTipoCuenta = tipoCuenta === 'cuenta_corriente' || tipoCuenta === 'cuenta_vista' || tipoCuenta === 'cuenta_ahorro';

  const userId = (session.user as { id?: string })?.id || null;

  const { data, error } = await supabaseAdmin
    .from('maestros')
    .insert({
      codigo: codigoData,
      nombre,
      rut: rut.toUpperCase().replace(/\./g, ''),
      email: sanitizeString(body?.email)?.trim() || null,
      telefono: sanitizeString(body?.telefono)?.trim() || null,
      banco: sanitizeString(body?.banco)?.trim() || null,
      tipo_cuenta: validTipoCuenta ? tipoCuenta : null,
      numero_cuenta: sanitizeString(body?.numero_cuenta)?.trim() || null,
      porcentaje_comision: porcentaje,
      activo: body?.activo !== false,
      notas: sanitizeString(body?.notas) || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Código duplicado, reintenta' }, { status: 409 });
    }
    console.error('[maestros-create-fail]', error);
    return NextResponse.json({ error: 'Error creando maestro' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, maestro: data });
}
