import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { origenValido } from '@/lib/origen';
import { cabecera, crearCotizacion } from '@/lib/cotizaciones-servidor';
import { CotizacionEsquema } from '@/lib/esquemas';
import { leerCotizacion } from '@/lib/panel';

/** Copia con número nuevo. Las fechas se limpian: son de la cotización anterior. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('cotizaciones', 'create'))) return forbiddenResponse();
  const id = Number((await params).id);
  const o = Number.isInteger(id) && id > 0 ? await leerCotizacion(id) : null;
  if (!o) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const p = CotizacionEsquema.safeParse({
    cliente_nombre: o.cliente_nombre,
    cliente_rut: o.cliente_rut,
    cliente_contacto: o.cliente_contacto,
    contacto_email: o.contacto_email,
    cliente_telefono: o.cliente_telefono,
    cliente_direccion: o.cliente_direccion,
    servicio_detalle: o.servicio_detalle,
    destino_nombre: o.destino_nombre,
    ubicacion_servicio: o.ubicacion_servicio,
    validez_dias: o.validez_dias ?? 15,
    descuento_neto: o.descuento_neto,
    notas_cliente: o.notas_cliente,
    lineas: o.lineas.map((l) => ({ ...l, detalle: null })),
  });
  const cab = p.success ? cabecera(p.data) : null;
  const creada = p.success && cab ? await crearCotizacion(cab, p.data.lineas, {}) : null;
  if (!creada) {
    logSafeError('[panel] duplicar cotización');
    return NextResponse.json({ error: 'No se pudo duplicar.' }, { status: 500 });
  }
  return NextResponse.json({ id: creada.id, numero: creada.numero }, { status: 201 });
}
