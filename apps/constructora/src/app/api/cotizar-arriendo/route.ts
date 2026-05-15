/**
 * POST /api/cotizar-arriendo
 *
 * Endpoint público (rate-limited) que:
 *  1. Valida input
 *  2. Carga máquina + tarifas vigentes de DB
 *  3. Calcula cotización con `pricing-arriendo`
 *  4. Inserta `cotizaciones_arriendo` con snapshot
 *  5. Retorna desglose + número COT-AR-YYYY-NNN
 *
 * GET /api/cotizar-arriendo?preview=true&maquinariaId=N&unidades=X&km=Y
 *  Modo preview SIN persistir — útil para que el wizard muestre desglose en vivo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { isValidOrigin, sanitizeString, isValidEmail } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { maskEmail, hid } from '@jurmaq/shared/logging';
import { sendCotizacionArriendoEmail } from '@jurmaq/shared/mail/templates/cotizacion-arriendo';
import {
  calcularCotizacion,
  validarInput,
  verificarDisponibilidad,
  type CotizacionInput,
  type MaquinariaPricing,
  type TarifasTraslado,
} from '@/lib/pricing-arriendo';

async function loadMaquinaria(id: number): Promise<MaquinariaPricing | null> {
  const { data } = await supabaseAdmin
    .from('maquinarias')
    .select('id, nombre, tarifa_neta, unidad_tarifa, minimo_unidades, requiere_traslado, estado')
    .eq('id', id)
    .single();
  if (!data || data.estado !== 'disponible') return null;
  if (!data.tarifa_neta || !data.unidad_tarifa || !data.minimo_unidades) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    tarifa_neta: Number(data.tarifa_neta),
    unidad_tarifa: data.unidad_tarifa as 'hora' | 'dia',
    minimo_unidades: Number(data.minimo_unidades),
    requiere_traslado: Boolean(data.requiere_traslado ?? true),
  };
}

async function loadTarifasVigentes(): Promise<TarifasTraslado | null> {
  const { data } = await supabaseAdmin
    .from('tarifa_traslado_actual')
    .select('*')
    .single();
  if (!data) return null;
  return {
    costo_km: Number(data.costo_km),
    costo_hora_operario: Number(data.costo_hora_operario),
    carga_descarga_horas: Number(data.carga_descarga_horas),
    reserva_mantencion_pct: Number(data.reserva_mantencion_pct),
    reserva_utilidad_pct: Number(data.reserva_utilidad_pct),
  };
}

// ---------------------------------------------------------------------------
// GET: preview en vivo (no persiste)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // Rate-limit más generoso (50/min) — wizard puede recalcular muchas veces.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cot-preview:${ip}`, { maxAttempts: 50, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const maquinariaId = parseInt(searchParams.get('maquinariaId') || '0', 10);
    const unidades = Number(searchParams.get('unidades') || 0);
    const km = Number(searchParams.get('km') || 0);
    const peajes = Number(searchParams.get('peajes') || 0);
    const operarios = parseInt(searchParams.get('operarios') || '1', 10);
    const horasOp = Number(searchParams.get('horasOperario') || 0);

    if (!maquinariaId || maquinariaId <= 0) {
      return NextResponse.json({ error: 'maquinariaId es requerido' }, { status: 400 });
    }

    const [maquinaria, tarifas] = await Promise.all([
      loadMaquinaria(maquinariaId),
      loadTarifasVigentes(),
    ]);

    if (!maquinaria) {
      return NextResponse.json(
        { error: 'Maquinaria no encontrada o sin tarifa configurada' },
        { status: 404 },
      );
    }
    if (!tarifas) {
      return NextResponse.json(
        { error: 'No hay tarifas de traslado vigentes configuradas' },
        { status: 503 },
      );
    }

    const input: CotizacionInput = {
      maquinaria,
      tarifas,
      unidades_solicitadas: unidades,
      distancia_km: km,
      peajes,
      operarios,
      horas_operario_estimadas: horasOp,
    };

    const err = validarInput(input);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const desglose = calcularCotizacion(input);

    // Públicamente NO retornar reservas internas
    const { reserva_mantencion: _r, utilidad_real: _u, ...publicDesglose } = desglose;

    return NextResponse.json({
      maquinaria: { id: maquinaria.id, nombre: maquinaria.nombre, unidad: maquinaria.unidad_tarifa, minimo: maquinaria.minimo_unidades },
      desglose: publicDesglose,
    });
  } catch (err) {
    console.error('[cot-preview]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Error calculando cotización' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST: crear cotización persistente
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limiter = rateLimit(`cot-create:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera un minuto.' },
        { status: 429 },
      );
    }

    const body = await request.json();

    // Validación de datos del cliente
    const cliente_nombre = sanitizeString(body.cliente_nombre);
    const cliente_email = sanitizeString(body.cliente_email);
    if (!cliente_nombre || cliente_nombre.length < 2) {
      return NextResponse.json({ error: 'cliente_nombre es requerido' }, { status: 400 });
    }
    if (!cliente_email || !isValidEmail(cliente_email)) {
      return NextResponse.json({ error: 'cliente_email es requerido y válido' }, { status: 400 });
    }

    const maquinariaId = parseInt(body.maquinariaId, 10);
    const unidades = Number(body.unidades_solicitadas);
    const km = Number(body.distancia_km || 0);
    const peajes = Number(body.peajes || 0);
    const operarios = parseInt(body.operarios || 1, 10);
    const horasOp = Number(body.horas_operario_estimadas || 0);
    const fechaServicio = sanitizeString(body.fecha_servicio);
    const ubicacion = sanitizeString(body.ubicacion_servicio);

    if (!fechaServicio || !ubicacion) {
      return NextResponse.json({ error: 'fecha_servicio y ubicacion_servicio son requeridos' }, { status: 400 });
    }

    const [maquinaria, tarifas] = await Promise.all([
      loadMaquinaria(maquinariaId),
      loadTarifasVigentes(),
    ]);

    if (!maquinaria) {
      return NextResponse.json({ error: 'Maquinaria no disponible' }, { status: 404 });
    }
    if (!tarifas) {
      return NextResponse.json({ error: 'Sistema de tarifas no configurado' }, { status: 503 });
    }

    const input: CotizacionInput = {
      maquinaria,
      tarifas,
      unidades_solicitadas: unidades,
      distancia_km: km,
      peajes,
      operarios,
      horas_operario_estimadas: horasOp,
    };

    const err = validarInput(input);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const desglose = calcularCotizacion(input);

    const disponibilidad = await verificarDisponibilidad(
      maquinaria.id,
      fechaServicio,
      fechaServicio,
    );
    if (!disponibilidad.disponible) {
      return NextResponse.json(
        {
          error: 'Maquinaria no disponible en la fecha solicitada',
          conflictos: disponibilidad.conflictos,
        },
        { status: 409 },
      );
    }

    // Generar número
    const { data: numeroRpc, error: numeroErr } = await supabaseAdmin.rpc('next_cot_arriendo_numero');
    if (numeroErr || !numeroRpc) {
      console.error('[cot-create-numero]', numeroErr);
      return NextResponse.json({ error: 'No se pudo generar numero' }, { status: 500 });
    }

    // Insertar
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('cotizaciones_arriendo')
      .insert({
        numero: numeroRpc,
        maquinaria_id: maquinaria.id,
        cliente_nombre,
        cliente_email,
        cliente_telefono: sanitizeString(body.cliente_telefono) || null,
        cliente_rut: sanitizeString(body.cliente_rut) || null,
        cliente_empresa: sanitizeString(body.cliente_empresa) || null,
        fecha_servicio: fechaServicio,
        ubicacion_servicio: ubicacion,
        distancia_km: km,
        unidades_solicitadas: unidades,
        unidad: maquinaria.unidad_tarifa,
        peajes,
        operarios,
        horas_operario_estimadas: horasOp,
        notas_cliente: sanitizeString(body.notas_cliente) || null,
        // desglose
        precio_uso: desglose.precio_uso,
        traslado_combustible: desglose.traslado_combustible,
        traslado_carga: desglose.traslado_carga,
        traslado_operario: desglose.traslado_operario,
        subtotal_neto: desglose.subtotal_neto,
        iva: desglose.iva,
        total: desglose.total,
        reserva_mantencion: desglose.reserva_mantencion,
        utilidad_real: desglose.utilidad_real,
        estado: 'enviada',
        // snapshots
        snapshot_tarifa_neta: maquinaria.tarifa_neta,
        snapshot_costo_km: tarifas.costo_km,
        snapshot_costo_hora_operario: tarifas.costo_hora_operario,
        snapshot_mantencion_pct: tarifas.reserva_mantencion_pct,
        snapshot_utilidad_pct: tarifas.reserva_utilidad_pct,
      })
      .select('id, numero')
      .single();

    if (insertErr || !inserted) {
      console.error('[cot-create-insert]', insertErr);
      return NextResponse.json({ error: 'No se pudo crear cotizacion' }, { status: 500 });
    }

    console.log('[cot-arriendo-ok]', {
      id: hid(inserted.id),
      numero: inserted.numero,
      email: maskEmail(cliente_email),
      maquinaria_id: maquinaria.id,
      total: desglose.total,
    });

    // Retornar al cliente (sin reservas internas)
    const { reserva_mantencion: _r, utilidad_real: _u, ...publicDesglose } = desglose;

    // Enviar email de confirmación (no-blocking, no se rompe la respuesta si falla)
    sendCotizacionArriendoEmail({
      numero: inserted.numero,
      cliente_nombre,
      cliente_email,
      maquinaria_nombre: maquinaria.nombre,
      fecha_servicio: fechaServicio,
      ubicacion_servicio: ubicacion,
      unidades_solicitadas: unidades,
      unidad: maquinaria.unidad_tarifa,
      desglose: publicDesglose,
    }).catch((e) => {
      console.error('[cot-arriendo-email-async-fail]', e instanceof Error ? e.message : String(e));
    });

    return NextResponse.json({
      id: inserted.id,
      numero: inserted.numero,
      maquinaria: { id: maquinaria.id, nombre: maquinaria.nombre, unidad: maquinaria.unidad_tarifa },
      desglose: publicDesglose,
      mensaje: 'Cotización creada. Recibirás un email de confirmación.',
    });
  } catch (err) {
    console.error('[cot-create]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Error creando cotización' }, { status: 500 });
  }
}
