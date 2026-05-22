import 'server-only';
import { supabaseAdmin } from '../supabase';
import { maskEmail } from '../logging';

/**
 * Helper para crear notificaciones in-app del admin (Tier 6 F4).
 *
 * Uso desde cualquier route handler / cron / trigger:
 *
 *   import { createAdminNotification } from '@jurmaq/shared/notifications/admin';
 *   await createAdminNotification({
 *     kind: 'review_pendiente',
 *     title: 'Nueva review esperando moderación',
 *     body: 'Producto X — 5★ — sin compra verificada',
 *     link: '/admin/reviews?estado=pendiente',
 *     severity: 'warning',
 *     ref_type: 'review',
 *     ref_id: reviewId,
 *   });
 *
 * NO bloquea el flujo principal: errores se loguean pero la promise resuelve
 * a `{ ok: false }` para que el caller decida si reintenta o no.
 */

export type NotificationKind =
  | 'review_pendiente'
  | 'comision_devengada'
  | 'cotizacion_nueva'
  | 'carrito_abandonado_conv'
  | 'mantencion_proxima'
  | 'stock_bajo'
  | 'cotizacion_arriendo_nueva'
  | 'otro';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface CreateAdminNotificationArgs {
  kind: NotificationKind | string;
  title: string;
  body?: string;
  link?: string;
  severity?: NotificationSeverity;
  ref_type?: string;
  ref_id?: string;
}

export async function createAdminNotification(
  args: CreateAdminNotificationArgs,
): Promise<{ ok: boolean; id?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
        kind: String(args.kind).slice(0, 80),
        title: String(args.title).slice(0, 200),
        body: args.body ? String(args.body).slice(0, 1000) : null,
        link: args.link ? String(args.link).slice(0, 500) : null,
        severity: args.severity || 'info',
        ref_type: args.ref_type ? String(args.ref_type).slice(0, 50) : null,
        ref_id: args.ref_id ? String(args.ref_id).slice(0, 100) : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[admin-notif-create-fail]', {
        kind: args.kind,
        error: String(error),
      });
      return { ok: false };
    }
    return { ok: true, id: data.id as string };
  } catch (err) {
    console.error('[admin-notif-create-throw]', {
      kind: args.kind,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Dedupe: crea una notif solo si no existe ya una idéntica reciente
 * (mismo ref_type+ref_id en últimas N horas). Útil para crons que corren
 * a diario y no queremos spamear.
 */
export async function createAdminNotificationIfNew(
  args: CreateAdminNotificationArgs & { dedupHours?: number },
): Promise<{ ok: boolean; id?: string; deduplicated?: boolean }> {
  if (!args.ref_type || !args.ref_id) {
    return createAdminNotification(args);
  }
  const dedupHours = args.dedupHours ?? 24;
  const cutoff = new Date(Date.now() - dedupHours * 3600 * 1000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from('admin_notifications')
    .select('id')
    .eq('ref_type', args.ref_type)
    .eq('ref_id', args.ref_id)
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, id: existing.id as string, deduplicated: true };
  }
  return createAdminNotification(args);
}

/** Util para mantener emails fuera de los logs del notif body. */
export function maskEmailForNotif(email: string | null | undefined): string {
  if (!email) return '';
  return maskEmail(email);
}
