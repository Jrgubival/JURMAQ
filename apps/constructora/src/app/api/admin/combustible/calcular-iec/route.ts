import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

/**
 * GET /api/admin/combustible/calcular-iec?tipo=diesel&litros=100&fecha=2026-05-09
 *
 * Audit M8: calcula el IEC sugerido para una factura usando la tabla
 * `combustible_tarifas_iec`. Antes el admin ingresaba el monto IEC a mano
 * lo que causaba errores en F29 declarations. Ahora la UI llama a este
 * endpoint cuando cambia tipo/litros/fecha y prepopula el campo.
 *
 * Devuelve { iec_sugerido, decreto_supremo, fuente } o { iec_sugerido: 0,
 * sin_tarifa: true } si no hay tarifa configurada para ese periodo.
 *
 * Requiere migrate-combustible-iec-tarifas.sql aplicada.
 */
export async function GET(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('combustible', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const url = new URL(request.url);
  const tipo = String(url.searchParams.get('tipo') || '').trim();
  const litros = Number(url.searchParams.get('litros') || 0);
  const fecha = String(url.searchParams.get('fecha') || '').trim();

  const TIPOS_VALIDOS = new Set(['diesel', 'gasolina_93', 'gasolina_95', 'gasolina_97', 'kerosene']);
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json(
      { error: 'tipo invalido (diesel|gasolina_93|gasolina_95|gasolina_97|kerosene)' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(litros) || litros <= 0 || litros > 100000) {
    return NextResponse.json({ error: 'litros invalidos (debe ser > 0 y < 100000)' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'fecha invalida (formato YYYY-MM-DD)' }, { status: 400 });
  }

  try {
    // Calcula via funcion SQL (que tambien aplica vigencia de la tarifa).
    const { data: iecData, error: iecErr } = await supabaseAdmin.rpc('combustible_calcular_iec', {
      p_tipo: tipo,
      p_litros: litros,
      p_fecha: fecha,
    });
    if (iecErr) {
      const code = (iecErr as { code?: string }).code;
      const msg = (iecErr as { message?: string }).message || '';
      if (code === 'PGRST202' || /combustible_calcular_iec/.test(msg)) {
        return NextResponse.json(
          { error: 'Falta migrate-combustible-iec-tarifas.sql en Supabase' },
          { status: 503 }
        );
      }
      throw iecErr;
    }
    const iec = Number(iecData ?? 0);

    // Adjunta info de la tarifa para mostrar al admin (decreto, fuente).
    const { data: tarifaRows } = await supabaseAdmin.rpc('combustible_tarifa_iec_aplicable', {
      p_tipo: tipo,
      p_fecha: fecha,
    });
    const tarifa = Array.isArray(tarifaRows) ? tarifaRows[0] : null;

    if (iec === 0 && !tarifa) {
      return NextResponse.json({
        iec_sugerido: 0,
        sin_tarifa: true,
        mensaje: `No hay tarifa IEC configurada para ${tipo} en la fecha ${fecha}. Ingresalo manualmente o agrega la tarifa en /admin/combustible/tarifas.`,
      });
    }

    return NextResponse.json({
      iec_sugerido: iec,
      tipo,
      litros,
      fecha,
      decreto_supremo: tarifa?.decreto_supremo || null,
      componente_fijo_clp_litro: tarifa?.componente_fijo_clp_litro ?? null,
    });
  } catch (err) {
    console.error('[calcular-iec] error:', err);
    return NextResponse.json({ error: 'Error al calcular IEC' }, { status: 500 });
  }
}
