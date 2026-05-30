import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { escapeLikePattern } from '@jurmaq/shared/sanitize';

/**
 * Lógica única de validación/cálculo de cupones, compartida por:
 *   - POST /api/public/cupones/validar  (preview en el carrito, no consume)
 *   - POST /api/cotizaciones             (aplicación real, autoritativa server-side)
 *
 * Regla de oro: el descuento que cobra el negocio se calcula SIEMPRE aquí
 * (server-side) contra el total recalculado; nunca se confía en el monto que
 * envía el cliente.
 */

export type CuponOk = {
  ok: true;
  cupon_id: string;
  codigo: string;
  descripcion: string | null;
  descuento: number;
  monto_final: number;
};
export type CuponError = { ok: false; status: number; error: string };
export type CuponResultado = CuponOk | CuponError;

const CODIGO_RE = /^[A-Z0-9_-]{3,30}$/;

export async function validarCupon(opts: {
  codigo: string;
  monto: number;
  email?: string;
}): Promise<CuponResultado> {
  const codigo = (opts.codigo || '').toUpperCase().trim();
  const monto = Number(opts.monto) || 0;
  const email = (opts.email || '').toLowerCase().trim();

  if (!codigo || !CODIGO_RE.test(codigo)) return { ok: false, status: 400, error: 'Código inválido' };
  if (monto <= 0) return { ok: false, status: 400, error: 'Monto debe ser mayor a cero' };

  const { data: cupon } = await supabaseAdmin
    .from('barraca_cupones')
    .select(
      'id, codigo, tipo, valor, descripcion, monto_minimo_compra, max_usos_total, max_usos_por_usuario, usos_actuales, valido_desde, valido_hasta, activo',
    )
    .eq('codigo', codigo)
    .maybeSingle();

  if (!cupon || !cupon.activo) return { ok: false, status: 404, error: 'Cupón no encontrado o inactivo' };

  const now = new Date();
  if (cupon.valido_desde && new Date(String(cupon.valido_desde)) > now) {
    return { ok: false, status: 410, error: 'Cupón aún no vigente' };
  }
  if (cupon.valido_hasta && new Date(String(cupon.valido_hasta)) < now) {
    return { ok: false, status: 410, error: 'Cupón vencido' };
  }
  if (cupon.max_usos_total && Number(cupon.usos_actuales) >= Number(cupon.max_usos_total)) {
    return { ok: false, status: 410, error: 'Cupón agotado' };
  }
  if (monto < Number(cupon.monto_minimo_compra)) {
    return {
      ok: false,
      status: 412,
      error: `Requiere compra mínima de $${Number(cupon.monto_minimo_compra).toLocaleString('es-CL')}`,
    };
  }

  if (email && Number(cupon.max_usos_por_usuario) > 0) {
    const { count } = await supabaseAdmin
      .from('barraca_cupones_usos')
      .select('*', { count: 'exact', head: true })
      .eq('cupon_id', cupon.id)
      .ilike('email', escapeLikePattern(email));
    if ((count ?? 0) >= Number(cupon.max_usos_por_usuario)) {
      return { ok: false, status: 409, error: 'Ya usaste este cupón anteriormente' };
    }
  }

  // Descuento SIEMPRE acotado a [0, monto]: evita monto_final negativo con
  // cupones de porcentaje mal configurados (p.ej. valor=120 → 120%).
  const bruto =
    cupon.tipo === 'porcentaje'
      ? Math.round((monto * Number(cupon.valor)) / 100)
      : Number(cupon.valor);
  const descuento = Math.max(0, Math.min(bruto, monto));

  return {
    ok: true,
    cupon_id: cupon.id as string,
    codigo: cupon.codigo as string,
    descripcion: (cupon.descripcion as string | null) ?? null,
    descuento,
    monto_final: monto - descuento,
  };
}

/**
 * Registra el uso del cupón tras crear la cotización. Best-effort: si falla,
 * loguea pero NO revienta la cotización (ya creada y con el descuento aplicado).
 * La fuente de verdad del límite por-usuario es el COUNT de filas en
 * barraca_cupones_usos (siempre exacto); usos_actuales es un agregado para
 * max_usos_total y el panel admin.
 */
export async function registrarUsoCupon(opts: {
  cuponId: string;
  cotizacionId: number;
  email: string;
  descuento: number;
  montoCompra: number;
}): Promise<void> {
  const { error: usoErr } = await supabaseAdmin.from('barraca_cupones_usos').insert({
    cupon_id: opts.cuponId,
    cotizacion_id: opts.cotizacionId,
    email: opts.email.toLowerCase().trim(),
    descuento_aplicado: opts.descuento,
    monto_compra: opts.montoCompra,
  });
  if (usoErr) {
    console.error('[cupon-uso-insert]', usoErr);
    return;
  }
  const { data: cur } = await supabaseAdmin
    .from('barraca_cupones')
    .select('usos_actuales')
    .eq('id', opts.cuponId)
    .maybeSingle();
  const next = (Number(cur?.usos_actuales) || 0) + 1;
  const { error: incErr } = await supabaseAdmin
    .from('barraca_cupones')
    .update({ usos_actuales: next })
    .eq('id', opts.cuponId);
  if (incErr) console.error('[cupon-uso-incremento]', incErr);
}
