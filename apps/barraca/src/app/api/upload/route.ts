import { NextResponse } from 'next/server';

/**
 * POST /api/upload — desactivada (nov-2026).
 * Era la subida anónima de archivos del antiguo formulario de cotización, que
 * se reemplazó por la tienda en línea. Abierta a cualquiera servía para alojar
 * archivos en el bucket público. Los comprobantes de transferencia y las
 * boletas van por sus propias rutas, con el pedido y buckets privados.
 */
export function POST() {
  return NextResponse.json({ error: 'Esta función ya no está disponible' }, { status: 410 });
}
