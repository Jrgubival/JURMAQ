import 'server-only';
import { supabaseAdmin } from "@jurmaq/shared/supabase";

/**
 * Cola de retry para envios de email que fallan (audit M3).
 *
 * Uso esperado:
 *   - El handler que envia un email importante (ej. contrato firmado) llama
 *     a sendEmailOrEnqueue(). Si el send es exitoso, retorna sin tocar la
 *     cola. Si el send falla, encola el envio con backoff exponencial.
 *   - Un cron periodico (POST /api/cron/email-queue/retry) procesa los
 *     pendientes vencidos.
 *   - Se reintenta hasta 5 veces con espera 5s, 30s, 5min, 30min, 2h.
 *     Despues queda en estado 'failed' y el admin lo revisa manual.
 *
 * Si la migrate-email-queue.sql no esta aplicada, los inserts fallan
 * silenciosamente con un warning en console — el flow original (sign/
 * cotizacion/etc.) no se rompe.
 */

export type EmailTemplateKind =
  | 'signed_contract'
  | 'cotizacion'
  | 'cotizacion_admin'
  | 'otp'
  | 'payment_link'
  | 'generic';

export interface EmailQueueItem {
  to: string;
  subject: string;
  templateKind: EmailTemplateKind;
  payload: Record<string, unknown>;
  context?: Record<string, unknown>;
  maxAttempts?: number;
}

const BACKOFF_SECONDS = [5, 30, 300, 1800, 7200]; // 5s, 30s, 5m, 30m, 2h

function nextAttemptDelaySeconds(attempts: number): number {
  return BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)];
}

/**
 * Encola un envio para retry. Idempotente respecto a la creacion: cada llamada
 * inserta un nuevo row (no deduplica) para que cada falla quede registrada.
 * Si la tabla no existe (falta migracion), loguea y retorna ok igual para
 * no romper el flow del caller.
 */
export async function enqueueEmail(item: EmailQueueItem, errorMessage: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('email_queue').insert({
      to_email: item.to,
      subject: item.subject,
      payload: item.payload,
      template_kind: item.templateKind,
      context: item.context ?? null,
      max_attempts: item.maxAttempts ?? 5,
      attempts: 1,
      last_error: errorMessage,
      next_attempt_at: new Date(Date.now() + BACKOFF_SECONDS[0] * 1000).toISOString(),
      status: 'pending',
    });
    if (error) {
      // PGRST205 = tabla no existe
      const code = (error as { code?: string }).code;
      const msg = (error as { message?: string }).message || '';
      if (code === 'PGRST205' || /email_queue/.test(msg)) {
        console.warn('[email-queue] tabla no existe, falla silenciosa. Ejecuta migrate-email-queue.sql');
        return;
      }
      console.error('[email-queue] no se pudo encolar:', error, item);
    }
  } catch (err) {
    console.error('[email-queue] excepcion al encolar:', err);
  }
}

/**
 * Pide los proximos N pending items que ya vencieron, los marca como
 * "in flight" subiendo attempts y next_attempt_at temporalmente para
 * evitar que dos crons concurrentes los procesen dos veces.
 *
 * Race-safe: usa UPDATE ... WHERE status='pending' AND next_attempt_at <= now()
 * con RETURNING; solo el lambda que gana el row lo procesa.
 */
export async function dequeueEmails(limit = 10): Promise<Array<{
  id: number;
  to: string;
  subject: string;
  payload: Record<string, unknown>;
  templateKind: EmailTemplateKind;
  context: Record<string, unknown> | null;
  attempts: number;
  maxAttempts: number;
}>> {
  // Truco: como Supabase JS client no soporta UPDATE...RETURNING multiple rows
  // facilmente, hacemos SELECT + UPDATE por id. La race se mitiga por la columna
  // `attempts` (UPDATE incrementa atomicamente y verifica el valor previo).
  const { data: candidates, error } = await supabaseAdmin
    .from('email_queue')
    .select('id, to_email, subject, payload, template_kind, context, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) {
    const code = (error as { code?: string }).code;
    const msg = (error as { message?: string }).message || '';
    if (code === 'PGRST205' || /email_queue/.test(msg)) return [];
    throw error;
  }
  if (!candidates || candidates.length === 0) return [];

  const claimed: typeof out = [];
  type Row = (typeof candidates)[number];
  type Out = {
    id: number;
    to: string;
    subject: string;
    payload: Record<string, unknown>;
    templateKind: EmailTemplateKind;
    context: Record<string, unknown> | null;
    attempts: number;
    maxAttempts: number;
  };
  const out: Out[] = [];

  for (const c of candidates as Row[]) {
    const currentAttempts = (c as { attempts: number }).attempts;
    // CAS: solo procesa si attempts no cambio entre el SELECT y este UPDATE
    const { data: locked } = await supabaseAdmin
      .from('email_queue')
      .update({
        attempts: currentAttempts + 1,
        next_attempt_at: new Date(Date.now() + nextAttemptDelaySeconds(currentAttempts) * 1000).toISOString(),
      })
      .eq('id', (c as { id: number }).id)
      .eq('attempts', currentAttempts)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (locked) {
      out.push({
        id: (c as { id: number }).id,
        to: (c as { to_email: string }).to_email,
        subject: (c as { subject: string }).subject,
        payload: (c as { payload: Record<string, unknown> }).payload,
        templateKind: (c as { template_kind: EmailTemplateKind }).template_kind,
        context: (c as { context: Record<string, unknown> | null }).context,
        attempts: currentAttempts + 1,
        maxAttempts: (c as { max_attempts: number }).max_attempts,
      });
    }
  }
  void claimed;
  return out;
}

export async function markSent(id: number): Promise<void> {
  await supabaseAdmin
    .from('email_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
    .eq('id', id);
}

export async function markFailed(id: number, errorMessage: string, attempts: number, maxAttempts: number): Promise<void> {
  const finalStatus = attempts >= maxAttempts ? 'failed' : 'pending';
  await supabaseAdmin
    .from('email_queue')
    .update({
      status: finalStatus,
      last_error: errorMessage.substring(0, 1000),
      // si pending, next_attempt_at ya esta seteado al claim; si failed, deja igual.
    })
    .eq('id', id);
}
