import { NextRequest, NextResponse } from 'next/server';
import { dequeueEmails, markSent, markFailed } from '@/lib/email-queue';
import { transporter } from '@jurmaq/shared/mail/email';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { sendSignedContractEmailAsync } from '@/lib/signed-contract-email';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';

/**
 * POST /api/cron/email-queue/retry
 *
 * Cron job que procesa la cola de emails pendientes (audit M3). Para cada
 * item vencido (next_attempt_at <= now), reintenta el envio segun el
 * template_kind. Si falla, deja el item en pending con backoff; si excede
 * max_attempts queda en 'failed' para revision manual.
 *
 * Auth: header `x-cron-secret` con el valor de env CRON_SECRET. Sin esto,
 * cualquiera puede disparar reintentos y consumir cuota de Resend.
 *
 * Configurar en `vercel.json`:
 *   {
 *     "crons": [
 *       { "path": "/api/cron/email-queue/retry", "schedule": "*\/5 * * * *" }
 *     ]
 *   }
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 10;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const items = await dequeueEmails(BATCH_SIZE);
    if (items.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, failed: 0 });
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ id: number; status: string; error?: string }> = [];

    for (const item of items) {
      try {
        // Re-envia segun el template_kind. Cada kind sabe como reconstruir el
        // payload en una llamada concreta.
        switch (item.templateKind) {
          case 'signed_contract': {
            // Audit 2.3: REGENERAMOS el PDF desde el contrato + template (igual
            // que el envío inmediato). Antes este path mandaba el email SIN PDF
            // y con link de descarga vacío porque el payload solo traía numero+nombre.
            const contratoId = Number(item.context?.contrato_id);
            if (!contratoId) throw new Error('signed_contract sin contrato_id en context');

            const { data: contrato } = await supabaseAdmin
              .from('contratos')
              .select('*, maquinarias(*)')
              .eq('id', contratoId)
              .maybeSingle();
            if (!contrato) throw new Error(`contrato ${contratoId} no encontrado`);
            if (!contrato.firma_arrendatario || !contrato.firma_timestamp) {
              throw new Error(`contrato ${contratoId} sin firma; no se puede regenerar`);
            }

            // Template asignado al contrato, o el activo más reciente (mismo
            // criterio que el route de firma).
            let template: { contenido: string } | null = null;
            if (contrato.template_id) {
              const { data } = await supabaseAdmin
                .from('contratos_templates')
                .select('contenido')
                .eq('id', contrato.template_id)
                .maybeSingle();
              template = data ?? null;
            }
            if (!template) {
              const { data } = await supabaseAdmin
                .from('contratos_templates')
                .select('contenido')
                .eq('activo', true)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle();
              template = data ?? null;
            }
            if (!template) throw new Error('template no disponible para regenerar contrato');

            await sendSignedContractEmailAsync({
              contratoId,
              numero: String(contrato.numero),
              toEmail: String(contrato.arrendatario_email),
              arrendatarioNombre:
                (contrato.arrendatario_nombre as string) ||
                (contrato.arrendatario_razon_social as string) ||
                '',
              telefonoCliente: (contrato.arrendatario_telefono as string) || undefined,
              firmaTimestamp: String(contrato.firma_timestamp),
              firmaHash: String(contrato.firma_hash ?? ''),
              firmaIp: String(contrato.firma_ip ?? ''),
              firmaBase64: String(contrato.firma_arrendatario),
              firmaArrendador: (contrato.firma_arrendador as string | null) ?? null,
              templateContenido: template.contenido,
              contrato: contrato as Record<string, unknown>,
            });
            break;
          }
          case 'generic':
          default: {
            // Fallback: envio HTML crudo via transporter.
            const p = item.payload as { html: string; from?: string; bcc?: string | string[]; skipAdminBcc?: boolean };
            await transporter.sendMail({
              to: item.to,
              subject: item.subject,
              html: p.html,
              from: p.from,
              bcc: p.bcc,
              skipAdminBcc: p.skipAdminBcc,
            });
            break;
          }
        }
        await markSent(item.id);
        sent++;
        results.push({ id: item.id, status: 'sent' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await markFailed(item.id, msg, item.attempts, item.maxAttempts);
        failed++;
        results.push({ id: item.id, status: item.attempts >= item.maxAttempts ? 'failed_final' : 'will_retry', error: msg });
      }
    }

    return NextResponse.json({ processed: items.length, sent, failed, results });
  } catch (err) {
    console.error('[cron-email-retry] error:', err);
    return NextResponse.json({ error: 'Error procesando cola' }, { status: 500 });
  }
}
