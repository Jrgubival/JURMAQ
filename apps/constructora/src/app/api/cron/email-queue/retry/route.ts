import { NextRequest, NextResponse } from 'next/server';
import { dequeueEmails, markSent, markFailed } from '@/lib/email-queue';
import { transporter, sendSignedContractEmail } from '@jurmaq/shared/mail/email';

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
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  return provided === secret;
}

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
            // payload deberia tener: numero, nombre, html, pdf_url?, pdfBuffer? (base64)
            const p = item.payload as {
              numero: string;
              nombre: string;
              html: string;
              pdfUrl?: string;
              pdfBufferBase64?: string;
            };
            await sendSignedContractEmail(item.to, {
              numero: p.numero,
              arrendatarioNombre: p.nombre,
              pdfUrl: p.pdfUrl ?? '',
              pdfBuffer: p.pdfBufferBase64 ? Buffer.from(p.pdfBufferBase64, 'base64') : undefined,
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
