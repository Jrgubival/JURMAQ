import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@jurmaq/shared/auth/guard';
import {
  openwaProvider,
  cloudApiProvider,
  twilioSmsProvider,
  emailProvider,
} from '@jurmaq/shared/otp';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/**
 * GET /api/admin/otp/health
 *
 * Diagnóstico de los providers OTP. Devuelve el estado de cada uno +
 * estadísticas recientes de envíos/fallos.
 *
 * Permission: admin / gerente. NO público.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(_request: NextRequest) {
  const session = await requirePermission('usuarios', 'read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const providers = [openwaProvider, cloudApiProvider, twilioSmsProvider, emailProvider];

  // Health check en paralelo. AbortSignal.timeout dentro del provider protege
  // contra hangs.
  const healthList = await Promise.all(
    providers.map(async (p) => ({
      name: p.name,
      canal: p.canal,
      healthy: await p.isHealthy().catch(() => false),
    })),
  );

  // Stats últimas 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stats } = await supabaseAdmin
    .from('otp_eventos')
    .select('provider, evento, canal')
    .gte('created_at', since);

  type Stat = { provider: string; canal: string; sent: number; failed: number; verified: number };
  const byProvider = new Map<string, Stat>();
  for (const row of stats ?? []) {
    const key = `${row.provider}|${row.canal}`;
    const cur = byProvider.get(key) ?? {
      provider: String(row.provider),
      canal: String(row.canal),
      sent: 0,
      failed: 0,
      verified: 0,
    };
    if (row.evento === 'sent') cur.sent++;
    else if (row.evento === 'failed') cur.failed++;
    else if (row.evento === 'verified') cur.verified++;
    byProvider.set(key, cur);
  }

  return NextResponse.json({
    providers: healthList,
    stats_24h: Array.from(byProvider.values()),
    generated_at: new Date().toISOString(),
  });
}
