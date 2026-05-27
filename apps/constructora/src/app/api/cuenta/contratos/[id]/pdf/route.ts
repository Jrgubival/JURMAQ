import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { env } from '@jurmaq/shared/env';

/**
 * GET /api/cuenta/contratos/[id]/pdf
 *
 * Devuelve un redirect 302 al PDF/HTML del contrato. Sólo si:
 *   - El cliente está autenticado.
 *   - El contrato tiene `arrendatario_email` igual al email del cliente.
 *
 * Reusa el endpoint admin `/api/admin/contratos/[id]/pdf` que ya tiene la
 * lógica de render con snapshot (B-2). Para evitar exponer un endpoint con
 * permisos admin a un cliente, hacemos un redirect interno generando el
 * mismo HTML aquí (no como admin sino con validación de propiedad).
 *
 * Para simplificar Sprint 3: usamos el firma_token del contrato como
 * mecanismo de acceso al PDF (mismo enlace ya disponible por email). Si
 * el contrato no tiene firma_token (raro), devolvemos 404.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('id, arrendatario_email, estado, firma_token')
    .eq('id', id)
    .single();

  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (!contrato.arrendatario_email || contrato.arrendatario_email.toLowerCase() !== cliente.email.toLowerCase()) {
    // No reveles que el contrato existe — devolvé 404 para anti-enumeración.
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }

  // Redirect a la vista pública del contrato firmado vía firma_token. Si
  // está pendiente_firma, el cliente lo verá como tal con la posibilidad de
  // firmar; si ya está firmado, ve la copia PDF.
  if (!contrato.firma_token) {
    return NextResponse.json({ error: 'Contrato sin token de acceso' }, { status: 404 });
  }

  const url = `${env.NEXT_PUBLIC_SITE_URL || 'https://jurmaq.cl'}/contrato/firmar/${contrato.firma_token}`;
  return NextResponse.redirect(url, { status: 302 });
}
