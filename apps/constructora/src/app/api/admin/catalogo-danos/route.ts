import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/catalogo-danos[?tipo=retroexcavadora]
 *
 * Devuelve el catálogo de daños activo, opcionalmente filtrado por tipo de
 * maquinaria. Usado por GarantiaPanel para pre-llenar montos en la inspección
 * de devolución.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await requirePermission('contratos', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');

  let query = supabaseAdmin
    .from('catalogo_danos')
    .select('id, categoria, descripcion, monto_clp, aplicable_a_tipos')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('monto_clp', { ascending: true });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Error obteniendo catálogo' }, { status: 500 });
  }

  // Filtrar por tipo en memoria (Postgres array contains es engorroso vs RPC).
  const items = (data ?? []).filter((d) => {
    if (!tipo) return true;
    const arr = d.aplicable_a_tipos as string[] | null;
    if (!arr || arr.length === 0) return true; // NULL = todos
    return arr.includes(tipo);
  });

  return NextResponse.json({ items });
}
