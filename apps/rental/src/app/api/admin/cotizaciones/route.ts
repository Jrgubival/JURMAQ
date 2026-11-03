import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { origenValido } from '@/lib/origen';
import { CotizacionEsquema } from '@/lib/esquemas';
import { cabecera, crearCotizacion } from '@/lib/cotizaciones-servidor';

export async function POST(request: NextRequest) {
  if (!origenValido(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('cotizaciones', 'create'))) return forbiddenResponse();
  const p = CotizacionEsquema.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 });
  const cab = cabecera(p.data);
  if (!cab) return NextResponse.json({ error: 'Agrega al menos una máquina.' }, { status: 400 });

  const creada = await crearCotizacion(cab, p.data.lineas, { solicitud_id: p.data.solicitud_id });
  if (!creada) {
    logSafeError('[panel] crear cotización');
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ id: creada.id, numero: creada.numero }, { status: 201 });
}
