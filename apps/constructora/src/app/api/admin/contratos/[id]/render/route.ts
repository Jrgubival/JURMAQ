import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { renderContrato } from '@/lib/contrato-render';
import { buildRenderVars, injectFirmasIntoHtml } from '../../_helpers';

/**
 * GET /api/admin/contratos/[id]/render
 * Server-side render the contract HTML using the active template + vars.
 * Returns JSON `{ html: string }`. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('contratos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(*)')
      .eq('id', numericId)
      .single();

    if (error || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Prefer the template referenced by the contrato; fall back to the active one.
    let template: { id: number; contenido: string } | null = null;
    if (contrato.template_id) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('id, contenido')
        .eq('id', contrato.template_id)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('id, contenido')
        .eq('activo', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      return NextResponse.json({ error: 'No hay template disponible' }, { status: 500 });
    }

    const maquinaria = contrato.maquinarias ?? null;
    const vars = buildRenderVars(contrato, maquinaria);
    const renderedHtml = renderContrato(template.contenido, vars);
    // Inyectar las firmas (arrendador + arrendatario) si están disponibles
    // — así el preview admin muestra exactamente lo que el cliente firmó.
    const html = injectFirmasIntoHtml(renderedHtml, {
      firmaArrendador: contrato.firma_arrendador,
      firmaArrendatario: contrato.firma_arrendatario,
    });

    return NextResponse.json({ html });
  } catch (error) {
    console.error('Error al renderizar contrato:', error);
    return NextResponse.json({ error: 'Error al renderizar contrato' }, { status: 500 });
  }
}
