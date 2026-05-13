import type { Metadata } from 'next';
import { supabasePublic } from '@jurmaq/shared/supabase';
import WizardClient from './WizardClient';

export const metadata: Metadata = {
  title: 'Cotizar arriendo de maquinaria | JURMAQ',
  description: 'Cotiza tu arriendo de maquinaria pesada en 4 pasos: retroexcavadora, miniexcavadora, minicargador, brazo articulado, camión tolva. Tarifas transparentes, desglose con IVA.',
  alternates: {
    canonical: 'https://jurmaq.cl/cotizar-arriendo',
  },
};

interface MaquinariaCatalog {
  id: number;
  nombre: string;
  tipo: string;
  imagen: string | null;
  tarifa_neta: number;
  unidad_tarifa: 'hora' | 'dia';
  minimo_unidades: number;
  requiere_traslado: boolean;
}

export default async function CotizarArriendoPage() {
  // Solo máquinas con tarifa configurada (lo demás aún no soporta cotización online)
  const { data } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre, tipo, imagen, tarifa_neta, unidad_tarifa, minimo_unidades, requiere_traslado')
    .eq('estado', 'disponible')
    .not('tarifa_neta', 'is', null)
    .order('tipo');

  const maquinarias: MaquinariaCatalog[] = (data || []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    tipo: m.tipo,
    imagen: m.imagen,
    tarifa_neta: Number(m.tarifa_neta),
    unidad_tarifa: m.unidad_tarifa as 'hora' | 'dia',
    minimo_unidades: Number(m.minimo_unidades),
    requiere_traslado: Boolean(m.requiere_traslado ?? true),
  }));

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-navy-950 mb-2">
            Cotiza tu arriendo en 4 pasos
          </h1>
          <p className="text-gray-600">
            Tarifas transparentes. Desglose con IVA y traslado incluido. Sin sorpresas.
          </p>
        </header>

        {maquinarias.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              No hay maquinaria con tarifa online configurada en este momento.{' '}
              <a href="/contacto" className="text-orange-500 hover:underline font-semibold">
                Contáctanos por WhatsApp
              </a>{' '}
              y te enviamos cotización en menos de 1 hora.
            </p>
          </div>
        ) : (
          <WizardClient maquinarias={maquinarias} />
        )}

        {/* Trust signals */}
        <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white rounded p-4 shadow-sm">
            <p className="text-2xl mb-1">📋</p>
            <p className="text-sm font-semibold">Cotización al instante</p>
          </div>
          <div className="bg-white rounded p-4 shadow-sm">
            <p className="text-2xl mb-1">🚛</p>
            <p className="text-sm font-semibold">Traslado incluido</p>
          </div>
          <div className="bg-white rounded p-4 shadow-sm">
            <p className="text-2xl mb-1">📄</p>
            <p className="text-sm font-semibold">Factura con IVA</p>
          </div>
          <div className="bg-white rounded p-4 shadow-sm">
            <p className="text-2xl mb-1">⚡</p>
            <p className="text-sm font-semibold">Confirmación en email</p>
          </div>
        </section>
      </div>
    </div>
  );
}
