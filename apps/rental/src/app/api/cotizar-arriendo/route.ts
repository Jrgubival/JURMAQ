import { NextRequest, NextResponse, after } from 'next/server';
import { z } from '@jurmaq/shared/validation';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { createAdminNotification } from '@jurmaq/shared/notifications/admin';
import { isValidEmail, isValidOrigin } from '@jurmaq/shared/sanitize';
import { getClientIp, rateLimitPersistent } from '@jurmaq/shared/rate-limit';
import { hid, logSafeError } from '@jurmaq/shared/logging';
import { calcularTotales, textoCantidad } from '@/lib/cotizacion';
import { UNIDADES, leerMaquina } from '@/lib/maquinas';
import { enviarAcuseSolicitud } from '@/lib/solicitud-web';

const cuerpo = z.object({
  maquinaId: z.number().int().positive(),
  unidad: z.enum(UNIDADES),
  cantidad: z.number().positive().max(999),
  lugar: z.string().trim().min(2).max(200),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nombre: z.string().trim().min(2).max(120),
  telefono: z.string().trim().min(8).max(30),
  correo: z.string().trim().max(254),
  notas: z.string().trim().max(1000).optional(),
  // Trampa para bots: el formulario lo deja vacío.
  sitio: z.string().max(0).optional(),
}).strict();

/** POST /api/cotizar-arriendo — solicitud del sitio. Queda con su número COT-AR. */
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });

  const limite = await rateLimitPersistent(supabaseAdmin, `solicitud:${getClientIp(request)}`, { maxAttempts: 5, windowSeconds: 60 });
  if (!limite.success) return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });
  }
  const p = cuerpo.safeParse(json);
  if (!p.success || !isValidEmail(p.data.correo)) {
    return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });
  }
  const d = p.data;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  if (d.fecha < hoy) return NextResponse.json({ error: 'La fecha ya pasó.' }, { status: 400 });

  try {
    const [{ data: fila }, { data: tarifa }] = await Promise.all([
      supabaseAdmin.from('maquinarias').select('*').eq('id', d.maquinaId).maybeSingle(),
      supabaseAdmin.from('tarifa_traslado_actual').select('*').maybeSingle(),
    ]);
    if (!fila) return NextResponse.json({ error: 'Máquina no disponible.' }, { status: 404 });
    const m = leerMaquina(fila as Record<string, unknown>);
    if (!m.publicada) return NextResponse.json({ error: 'Máquina no disponible.' }, { status: 404 });

    // El monto sale de la base, nunca del cliente.
    const precio = m.precios.find((x) => x.unidad === d.unidad);
    const cantidad = Math.max(d.cantidad, precio?.unidad === 'hora' ? (m.minimoUnidades ?? 1) : 1);
    const totales = calcularTotales(
      precio ? [{ tipo: 'maquina', cantidad, precio_unitario: precio.valor }] : [],
      0,
    );

    const { data: numero, error: errNumero } = await supabaseAdmin.rpc('next_cot_arriendo_numero');
    if (errNumero || !numero) throw new Error('numero');

    const { data: creada, error } = await supabaseAdmin
      .from('cotizaciones_arriendo')
      .insert({
        numero,
        maquinaria_id: m.id,
        cliente_nombre: d.nombre,
        cliente_email: d.correo,
        cliente_telefono: d.telefono,
        fecha_servicio: d.fecha,
        ubicacion_servicio: d.lugar,
        unidades_solicitadas: cantidad,
        unidad: d.unidad,
        notas_cliente: d.notas || null,
        precio_uso: totales.maquinas,
        subtotal_neto: totales.neto,
        iva: totales.iva,
        total: totales.total,
        estado: 'enviada',
        snapshot_tarifa_neta: precio?.valor ?? 0,
        snapshot_costo_km: Number(tarifa?.costo_km ?? 0),
        snapshot_costo_hora_operario: Number(tarifa?.costo_hora_operario ?? 0),
        snapshot_mantencion_pct: Number(tarifa?.reserva_mantencion_pct ?? 0),
        snapshot_utilidad_pct: Number(tarifa?.reserva_utilidad_pct ?? 0),
      })
      .select('id, numero')
      .single();
    if (error || !creada) throw new Error('insert');

    after(async () => {
      await Promise.allSettled([
        enviarAcuseSolicitud({
          numero: creada.numero,
          nombre: d.nombre,
          correo: d.correo,
          maquina: m.nombre,
          cantidad: textoCantidad(cantidad, d.unidad),
          lugar: d.lugar,
          neto: totales.neto,
        }),
        createAdminNotification({
          kind: 'cotizacion_arriendo_nueva',
          title: `Solicitud de arriendo ${creada.numero}`,
          body: `${d.nombre} · ${m.nombre} · ${d.lugar}`,
          link: '/admin/cotizaciones-arriendo',
          severity: 'info',
          ref_type: 'cotizacion_arriendo',
          ref_id: String(creada.id),
        }),
      ]);
    });

    return NextResponse.json({ numero: creada.numero });
  } catch {
    logSafeError('[solicitud-web] crear', { maquina: hid(d.maquinaId) });
    return NextResponse.json({ error: 'No pudimos enviar tu solicitud. Escríbenos por WhatsApp.' }, { status: 500 });
  }
}
