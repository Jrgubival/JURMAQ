import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { transporter } from '@jurmaq/shared/mail/transport';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST /api/admin/contratos/[id]/entrega/iniciar
 *
 * Cambia el contrato a estado='en_entrega'. Si garantia_metodo='klap_hold',
 * genera un entrega_token (UUID) y envía al cliente un link al portal donde
 * ingresa su tarjeta. Si garantia_metodo es tradicional, solo cambia el
 * estado (admin marca la recepción aparte).
 *
 * Body: opcional `force: true` para re-generar el token aunque ya exista.
 */

const TOKEN_TTL_HOURS = 48;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('contratos', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const contratoId = parseInt(id, 10);
  if (Number.isNaN(contratoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select(
      'id, numero, estado, garantia_metodo, garantia_monto, arrendatario_email, arrendatario_nombre, arrendatario_razon_social, entrega_token, entrega_token_expira_at',
    )
    .eq('id', contratoId)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }
  if (!['firmado', 'vigente'].includes(contrato.estado) && !force) {
    return NextResponse.json(
      { error: `No se puede iniciar entrega cuando el contrato está en '${contrato.estado}'` },
      { status: 409 },
    );
  }

  let entregaToken = contrato.entrega_token as string | null;
  let tokenExpiraAt: string | null = (contrato.entrega_token_expira_at as string | null) ?? null;

  if (contrato.garantia_metodo === 'klap_hold') {
    if (!entregaToken || force) {
      entregaToken = crypto.randomBytes(32).toString('hex');
      tokenExpiraAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from('contratos')
    .update({
      estado: 'en_entrega',
      entrega_token: entregaToken,
      entrega_token_expira_at: tokenExpiraAt,
    })
    .eq('id', contratoId);

  if (updErr) {
    console.error('[entrega-iniciar-update-fail]', updErr);
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }

  await logContratoEvent(request, contratoId, 'delivery_registered', {
    garantia_metodo: String(contrato.garantia_metodo),
    token_generated: !!entregaToken && contrato.garantia_metodo === 'klap_hold',
  });

  // Si es Klap y hay email del arrendatario, enviar link al cliente.
  if (contrato.garantia_metodo === 'klap_hold' && entregaToken && contrato.arrendatario_email) {
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jurmaq.cl'}/cuenta/contratos/${encodeURIComponent(
      String(contrato.numero || contratoId),
    )}/entrega?token=${entregaToken}`;
    const nombre = contrato.arrendatario_nombre || contrato.arrendatario_razon_social || '';
    const montoFmt = new Intl.NumberFormat('es-CL').format(Number(contrato.garantia_monto) || 0);

    void transporter
      .sendMail({
        to: contrato.arrendatario_email,
        subject: `JURMAQ — Autoriza la garantía del contrato ${contrato.numero || contratoId}`,
        html: `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:24px auto;color:#0c1d3a;padding:0 16px">
<h2 style="margin:0 0 12px 0">Estamos listos para entregarte la máquina</h2>
<p>Hola ${nombre},</p>
<p>Antes de hacer entrega del equipo arrendado bajo el contrato <strong>${contrato.numero || `#${contratoId}`}</strong>, necesitamos que autorices una <strong>garantía pre-autorizada</strong> de <strong>$${montoFmt} CLP</strong> en tu tarjeta de crédito.</p>
<p><strong>Importante</strong>: este monto se retiene, NO se cobra. Se libera automáticamente al devolver la máquina sin daños.</p>
<p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Autorizar garantía</a></p>
<p style="font-size:13px;color:#666">El link vence en ${TOKEN_TTL_HOURS} horas.</p>
<hr style="border:0;border-top:1px solid #e5e5e5;margin:32px 0 16px"/>
<p style="font-size:11px;color:#999">JURMAQ — Constructora Jorge Ubilla Rivera E.I.R.L.</p>
</body></html>`,
        skipAdminBcc: true,
      })
      .catch((err) => console.error('[entrega-iniciar-email-fail]', err));
  }

  return NextResponse.json({ ok: true, entrega_token: entregaToken, expira_at: tokenExpiraAt });
}
