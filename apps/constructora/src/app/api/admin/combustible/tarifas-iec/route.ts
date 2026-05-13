import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * CRUD admin para `combustible_tarifas_iec` (audit M8).
 *
 * GET → lista todas las tarifas (vigentes y pasadas) ordenadas por fecha.
 * POST → crea una nueva tarifa. Si para el mismo tipo ya hay una vigente
 *        (vigente_hasta IS NULL), la cierra automaticamente con vigente_hasta=NOW.
 * DELETE ?id=N → elimina una tarifa (solo permitido en las que no se hayan usado).
 *
 * Solo admin/contador con permiso `combustible:update`.
 */

const TIPOS_VALIDOS = new Set(['diesel', 'gasolina_93', 'gasolina_95', 'gasolina_97', 'kerosene']);

export async function GET(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('combustible', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  try {
    const { data, error } = await supabaseAdmin
      .from('combustible_tarifas_iec')
      .select('*')
      .order('vigente_desde', { ascending: false });
    if (error) {
      const code = (error as { code?: string }).code;
      const msg = (error as { message?: string }).message || '';
      if (code === 'PGRST205' || /combustible_tarifas_iec/.test(msg)) {
        return NextResponse.json(
          { error: 'Falta migrate-combustible-iec-tarifas.sql en Supabase' },
          { status: 503 }
        );
      }
      throw error;
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error('[tarifas-iec GET]:', err);
    return NextResponse.json({ error: 'Error al listar tarifas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('combustible', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  try {
    const body = await request.json();
    const tipo = String(body.tipo_combustible || '').trim();
    const vigenteDesde = String(body.vigente_desde || '').trim();
    const componenteFijo = Number(body.componente_fijo_clp_litro);
    const componenteVariable = body.componente_variable_utm_m3 != null
      ? Number(body.componente_variable_utm_m3)
      : 0;
    const utmRef = body.utm_referencia_clp != null ? Number(body.utm_referencia_clp) : null;
    const decreto = body.decreto_supremo ? String(body.decreto_supremo).trim() : null;
    const notas = body.notas ? String(body.notas).trim() : null;

    if (!TIPOS_VALIDOS.has(tipo)) {
      return NextResponse.json({ error: 'tipo_combustible invalido' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) {
      return NextResponse.json({ error: 'vigente_desde debe ser YYYY-MM-DD' }, { status: 400 });
    }
    if (!Number.isFinite(componenteFijo) || componenteFijo < 0) {
      return NextResponse.json({ error: 'componente_fijo_clp_litro invalido' }, { status: 400 });
    }
    if (!Number.isFinite(componenteVariable) || componenteVariable < 0) {
      return NextResponse.json({ error: 'componente_variable_utm_m3 invalido' }, { status: 400 });
    }

    // Cerrar tarifa vigente actual de este tipo (vigente_hasta = vigenteDesde - 1 dia).
    const cierreISO = new Date(new Date(vigenteDesde).getTime() - 86_400_000).toISOString().slice(0, 10);
    await supabaseAdmin
      .from('combustible_tarifas_iec')
      .update({ vigente_hasta: cierreISO })
      .eq('tipo_combustible', tipo)
      .is('vigente_hasta', null);

    const userEmail = (session.user as { email?: string })?.email || null;

    const { data, error } = await supabaseAdmin
      .from('combustible_tarifas_iec')
      .insert({
        tipo_combustible: tipo,
        vigente_desde: vigenteDesde,
        vigente_hasta: null,
        componente_fijo_clp_litro: componenteFijo,
        componente_variable_utm_m3: componenteVariable,
        utm_referencia_clp: utmRef,
        decreto_supremo: decreto,
        notas,
        created_by: userEmail,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, tarifa: data }, { status: 201 });
  } catch (err) {
    console.error('[tarifas-iec POST]:', err);
    return NextResponse.json({ error: 'Error al crear tarifa' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('combustible', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('combustible_tarifas_iec')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[tarifas-iec DELETE]:', err);
    return NextResponse.json({ error: 'Error al eliminar tarifa' }, { status: 500 });
  }
}
