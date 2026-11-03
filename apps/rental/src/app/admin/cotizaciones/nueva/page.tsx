import { exigirPermiso } from '@/lib/panel';
import FormCotizacion, { type Inicial } from '@/components/admin/FormCotizacion';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { catalogoPanel } from '@/lib/catalogo-panel';

export default async function NuevaCotizacion({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  await exigirPermiso('cotizaciones', 'create');
  const catalogo = await catalogoPanel();
  const id = Number((await searchParams).solicitud);
  let inicial: Inicial | undefined;
  if (Number.isInteger(id) && id > 0) {
    const { data: s } = await supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, maquinaria_id, cliente_nombre, cliente_email, cliente_telefono, ubicacion_servicio, unidades_solicitadas, unidad, notas_cliente, fecha_servicio')
      .eq('id', id)
      .eq('origen', 'web')
      .maybeSingle();
    if (s) {
      const m = catalogo.find((x) => x.id === s.maquinaria_id);
      const precio = m?.precios.find((p) => p.unidad === s.unidad);
      inicial = {
        solicitud_id: s.id,
        cliente_nombre: s.cliente_nombre,
        contacto_email: s.cliente_email,
        cliente_telefono: s.cliente_telefono,
        ubicacion_servicio: s.ubicacion_servicio,
        notas_cliente: s.notas_cliente,
        entrega_at: s.fecha_servicio ? `${s.fecha_servicio}T09:00` : null,
        lineas: m ? [{
          tipo: 'maquina',
          maquinaria_id: m.id,
          descripcion: `Arriendo de ${m.nombre}`,
          detalle: null,
          cantidad: Number(s.unidades_solicitadas),
          unidad: s.unidad,
          precio_unitario: precio?.valor ?? 0,
        }] : [],
      };
    }
  }
  return (
    <>
      <h1 className="text-3xl">Nueva cotización</h1>
      <FormCotizacion catalogo={catalogo} inicial={inicial} />
    </>
  );
}
