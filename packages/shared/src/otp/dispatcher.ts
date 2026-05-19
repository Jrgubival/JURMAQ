import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../supabase';
import { generateOtpCode } from './codigo';
import { renderTemplate } from './templates';
import { openwaProvider } from './providers/openwa-provider';
import { cloudApiProvider } from './providers/cloud-api-provider';
import { twilioSmsProvider } from './providers/twilio-sms-provider';
import { emailProvider } from './providers/email-provider';
import type {
  OtpCanal,
  OtpContexto,
  OtpDispatchInput,
  OtpDispatchResult,
  OtpProvider,
  OtpProviderName,
} from './types';

/**
 * OTP Dispatcher.
 *
 * Selecciona canal en este orden:
 *   1) Preferencia explícita del caller (si está disponible)
 *   2) WhatsApp (OpenWA primero, Cloud API como respaldo)
 *   3) SMS (Twilio)
 *   4) Email (Resend) — siempre disponible
 *
 * El primero que healthcheckea y envía exitosamente gana.
 * Si todos fallan, devuelve ok=false con detalle de intentos.
 *
 * EFECTOS:
 *   - INSERT en otp_codigos (con bcrypt del código, NUNCA el código en plano).
 *   - INSERT en otp_eventos por cada intento (audit).
 *
 * El código se genera acá (no por el caller) para que ningún path lo loguee.
 */

const TTL_DEFAULT_MIN: Record<OtpContexto, number> = {
  firma_contrato: 5,
  garantia_klap: 5,
  tarjeta_cambio: 5,
  reset_password: 10,
  login_2fa: 5,
  verificacion_email: 30,
};

const PROVIDERS_BY_CANAL: Record<OtpCanal, OtpProvider[]> = {
  whatsapp: [openwaProvider, cloudApiProvider],
  sms: [twilioSmsProvider],
  email: [emailProvider],
};

export async function dispatchOtp(input: OtpDispatchInput, requestMeta?: { ip?: string; userAgent?: string }): Promise<OtpDispatchResult> {
  // 1. Generar código si no fue provisto (siempre lo generamos nosotros para
  //    evitar que loggers de upstream lo expongan).
  const codigo = generateOtpCode();
  const codigoHash = await bcrypt.hash(codigo, 10);
  const ttlMin = TTL_DEFAULT_MIN[input.contexto];
  const expiraAt = new Date(Date.now() + ttlMin * 60_000).toISOString();

  // 2. Filtrar canales según formato del destino. Si destino es email no
  //    tiene sentido intentar whatsapp/sms (sus providers requieren teléfono).
  const destinoEsEmail = input.destino.includes('@');
  const canalesPosibles: OtpCanal[] = destinoEsEmail
    ? ['email']
    : ['whatsapp', 'sms'];

  const ordenCanales = input.canalPreferido
    ? [input.canalPreferido, ...canalesPosibles.filter((c) => c !== input.canalPreferido)]
    : canalesPosibles;

  // 3. Probar providers en orden.
  const intentos: OtpDispatchResult['intentos'] = [];
  let exitoCanal: OtpCanal | undefined;
  let exitoProvider: OtpProviderName | undefined;
  let messageId: string | undefined;

  for (const canal of ordenCanales) {
    for (const provider of PROVIDERS_BY_CANAL[canal]) {
      const healthy = await provider.isHealthy().catch(() => false);
      if (!healthy) {
        intentos.push({ provider: provider.name, canal: provider.canal, ok: false, error: 'unhealthy' });
        continue;
      }
      const rendered = renderTemplate(canal, input.contexto, { codigo, vars: input.vars });
      const real = await provider.send(input.destino, rendered.body, { subject: rendered.subject });
      intentos.push({
        provider: provider.name,
        canal: provider.canal,
        ok: real.ok,
        error: real.error,
      });

      // Insertar en otp_eventos (best-effort).
      await supabaseAdmin
        .from('otp_eventos')
        .insert({
          evento: real.ok ? 'sent' : 'failed',
          canal: provider.canal,
          provider: provider.name,
          destino: input.destino,
          contexto: input.contexto,
          ip: requestMeta?.ip ?? null,
          user_agent: requestMeta?.userAgent ?? null,
          raw_response: real.raw ?? null,
          error_msg: real.error ?? null,
        })
        .then(() => undefined, () => undefined);

      if (real.ok) {
        exitoCanal = canal;
        exitoProvider = provider.name;
        messageId = real.messageId;
        break;
      }
    }
    if (exitoCanal) break;
  }

  if (!exitoCanal || !exitoProvider) {
    return {
      ok: false,
      intentos,
      error: 'Todos los canales fallaron',
    };
  }

  // 4. Guardar el código en otp_codigos (bcrypt hash).
  const { error: insertErr } = await supabaseAdmin.from('otp_codigos').insert({
    destino: input.destino,
    codigo_hash: codigoHash,
    contexto: input.contexto,
    contexto_id: input.contextoId ?? null,
    canal_usado: exitoCanal,
    provider: exitoProvider,
    expira_at: expiraAt,
  });

  if (insertErr) {
    // Mensaje ya se envió, pero el guardado falló — no podemos verificarlo
    // después. Devolver error explícito y dejar audit log.
    await supabaseAdmin
      .from('otp_eventos')
      .insert({
        evento: 'failed',
        canal: exitoCanal,
        provider: exitoProvider,
        destino: input.destino,
        contexto: input.contexto,
        error_msg: `otp_codigos insert failed: ${insertErr.message}`,
      })
      .then(() => undefined, () => undefined);
    return {
      ok: false,
      intentos,
      error: `OTP enviado por ${exitoCanal} pero no se pudo persistir: ${insertErr.message}`,
    };
  }

  return {
    ok: true,
    canalUsado: exitoCanal,
    provider: exitoProvider,
    messageId,
    fallbackUsed: !!input.canalPreferido && input.canalPreferido !== exitoCanal,
    intentos,
  };
}

/**
 * Verifica un código. Constant-time bcrypt compare. Incrementa intentos en
 * cada fallo. Marca verificado_at en éxito.
 */
export async function verifyOtp(opts: {
  destino: string;
  codigo: string;
  contexto: OtpContexto;
  contextoId?: string;
}): Promise<{ ok: boolean; error?: string; intentos_usados?: number }> {
  const { data, error } = await supabaseAdmin
    .from('otp_codigos')
    .select('id, codigo_hash, intentos, max_intentos, expira_at, verificado_at, contexto_id')
    .eq('destino', opts.destino)
    .eq('contexto', opts.contexto)
    .is('verificado_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'No hay código activo para este destino' };
  }
  if (new Date(data.expira_at) < new Date()) {
    return { ok: false, error: 'Código expirado' };
  }
  if (data.intentos >= data.max_intentos) {
    return { ok: false, error: 'Demasiados intentos. Solicita un código nuevo.' };
  }
  if (opts.contextoId && data.contexto_id && data.contexto_id !== opts.contextoId) {
    return { ok: false, error: 'Código no corresponde al contexto solicitado' };
  }

  const matches = await bcrypt.compare(opts.codigo, data.codigo_hash);
  if (!matches) {
    const nuevoIntento = data.intentos + 1;
    await supabaseAdmin
      .from('otp_codigos')
      .update({ intentos: nuevoIntento })
      .eq('id', data.id);
    await supabaseAdmin
      .from('otp_eventos')
      .insert({
        evento: 'failed',
        canal: 'email',     // canal no relevante en verify; placeholder
        provider: 'manual',
        destino: opts.destino,
        contexto: opts.contexto,
        otp_id: data.id,
      })
      .then(() => undefined, () => undefined);
    return { ok: false, error: 'Código incorrecto', intentos_usados: nuevoIntento };
  }

  await supabaseAdmin
    .from('otp_codigos')
    .update({ verificado_at: new Date().toISOString() })
    .eq('id', data.id);
  await supabaseAdmin
    .from('otp_eventos')
    .insert({
      evento: 'verified',
      canal: 'email',
      provider: 'manual',
      destino: opts.destino,
      contexto: opts.contexto,
      otp_id: data.id,
    })
    .then(() => undefined, () => undefined);

  return { ok: true };
}
