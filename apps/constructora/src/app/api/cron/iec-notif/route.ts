import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { transporter } from '@jurmaq/shared/mail/transport';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';

/**
 * POST /api/cron/iec-notif
 *
 * E3 Tier 5 — recordatorio mensual al admin sobre tarifa IEC.
 *
 * El SII publica decretos supremos con tarifas IEC actualizadas
 * periódicamente. Si no se actualiza la tabla `combustible_tarifas_iec`
 * cuando hay un decreto nuevo, las facturas siguen calculándose con la
 * tarifa anterior y la declaración F29 sale incorrecta.
 *
 * Este cron NO scrappea SII (out-of-scope). Solo envía email mensual con:
 *   - Tarifa actualmente vigente en DB
 *   - Fecha de última actualización
 *   - Link al SII para verificar manualmente
 *
 * Schedule sugerido: día 1 de cada mes, 8 AM (en vercel.json).
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const ADMIN_EMAIL = env.ADMIN_NOTIF_EMAIL || 'contacto@jurmaq.cl';

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Tarifa vigente más reciente por cada tipo de combustible.
  interface TarifaRow {
    tipo_combustible: string;
    vigente_desde: string | null;
    componente_fijo_clp_litro: number;
    decreto_supremo: string | null;
  }
  const { data: tarifas } = await supabaseAdmin
    .from('combustible_tarifas_iec')
    .select('tipo_combustible, vigente_desde, componente_fijo_clp_litro, decreto_supremo')
    .order('vigente_desde', { ascending: false });

  // Agrupar por tipo (la primera por tipo es la más reciente).
  const ultimaPorTipo = new Map<string, TarifaRow>();
  for (const t of (tarifas ?? []) as TarifaRow[]) {
    if (!ultimaPorTipo.has(t.tipo_combustible)) {
      ultimaPorTipo.set(t.tipo_combustible, t);
    }
  }

  const rowsHtml = Array.from(ultimaPorTipo.entries())
    .map(([tipo, t]) => {
      const dias = t.vigente_desde
        ? Math.floor((Date.now() - new Date(t.vigente_desde as string).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const accent = dias > 60 ? 'color:#dc2626;font-weight:600' : 'color:#374151';
      return `<tr>
        <td style="padding:6px 12px">${tipo}</td>
        <td style="padding:6px 12px;text-align:right">$${Number(t.componente_fijo_clp_litro).toLocaleString('es-CL')}/L</td>
        <td style="padding:6px 12px;${accent}">${t.vigente_desde ? new Date(t.vigente_desde as string).toLocaleDateString('es-CL') : '—'} (${dias}d atrás)</td>
        <td style="padding:6px 12px;font-size:11px;color:#6b7280">${t.decreto_supremo || '—'}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:680px;margin:24px auto;color:#0c1d3a;padding:0 16px">
<h2 style="margin:0 0 12px 0">Recordatorio mensual: tarifa IEC</h2>
<p>Verifica si SII publicó nuevos decretos. Si alguna tarifa quedó &gt; 60 días sin actualizar, está marcada en rojo.</p>
<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden">
  <thead style="background:#0c1d3a;color:#fff;font-size:12px">
    <tr>
      <th style="padding:8px 12px;text-align:left">Combustible</th>
      <th style="padding:8px 12px;text-align:right">Tarifa fija</th>
      <th style="padding:8px 12px;text-align:left">Vigente desde</th>
      <th style="padding:8px 12px;text-align:left">Decreto</th>
    </tr>
  </thead>
  <tbody style="font-size:13px">
    ${rowsHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af">Sin tarifas registradas</td></tr>'}
  </tbody>
</table>
<p style="margin-top:16px"><a href="https://www.sii.cl/normativa_legislacion/circulares/2026/circu.htm" style="color:#ea580c">Verificar en SII Circulares</a></p>
<p style="font-size:12px;color:#6b7280;margin-top:16px">Si alguna tarifa cambió: ingresa a <a href="https://jurmaq.cl/admin/combustible/tarifas">/admin/combustible/tarifas</a> y crea nueva tarifa (la anterior queda cerrada automáticamente).</p>
</body></html>`;

  try {
    await transporter.sendMail({
      to: ADMIN_EMAIL,
      subject: 'JURMAQ — Recordatorio mensual tarifa IEC',
      html,
      skipAdminBcc: true,
    });
    return NextResponse.json({
      ok: true,
      tipos_checked: ultimaPorTipo.size,
      sent_to: ADMIN_EMAIL,
    });
  } catch (err) {
    console.error('[iec-notif-fail]', err);
    return NextResponse.json({ error: 'Email fallo' }, { status: 500 });
  }
}
