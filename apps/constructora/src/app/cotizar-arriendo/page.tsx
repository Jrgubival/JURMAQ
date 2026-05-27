import type { Metadata } from 'next';
import { supabasePublic } from '@jurmaq/shared/supabase';
import WizardClient from './WizardClient';

export const metadata: Metadata = {
  title: 'Cotizar arriendo de maquinaria | JURMAQ',
  description: 'Cotiza tu arriendo de maquinaria pesada en 4 pasos: retroexcavadora, miniexcavadora, minicargador, brazo articulado, camión tolva. Tarifas transparentes, valores netos con desglose claro.',
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

export default async function CotizarArriendoPage({
  searchParams,
}: {
  searchParams: Promise<{
    maquinariaId?: string;
    ubicacion?: string;
    unidades?: string;
    km?: string;
    peajes?: string;
    operarios?: string;
    horasOp?: string;
    nombre?: string;
    email?: string;
    telefono?: string;
    rut?: string;
    empresa?: string;
  }>;
}) {
  const sp = await searchParams;
  const preselectId = sp.maquinariaId ? Number.parseInt(sp.maquinariaId, 10) : null;
  const validPreselect = Number.isFinite(preselectId) && preselectId! > 0 ? preselectId! : null;

  // C4 Fast checkout: pre-llenar campos del wizard desde URL params.
  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const prefill = {
    maquinariaId: validPreselect,
    ubicacion: sp.ubicacion || undefined,
    unidades: num(sp.unidades),
    km: num(sp.km),
    peajes: num(sp.peajes),
    operarios: num(sp.operarios),
    horasOp: num(sp.horasOp),
    cliente: {
      nombre: sp.nombre || undefined,
      email: sp.email || undefined,
      telefono: sp.telefono || undefined,
      rut: sp.rut || undefined,
      empresa: sp.empresa || undefined,
    },
  };

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
            Tarifas transparentes. Valores netos con desglose claro y traslado incluido. Sin sorpresas.
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
          <WizardClient maquinarias={maquinarias} preselectId={validPreselect} prefill={prefill} />
        )}

        {/* Trust signals — editorial list (skills: design-taste banned 3-col grids,
            impeccable banned 4-col equal cards, all banned emojis as icons).
            Reemplazado por lista hairline con SVG inline. */}
        <section className="mt-14 border-y border-[#EAEAEA] divide-y divide-[#EAEAEA] sm:divide-y-0 sm:divide-x sm:grid sm:grid-cols-4">
          {[
            { title: 'Cotización al instante', d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2' },
            { title: 'Traslado incluido', d: 'M3 17V7a2 2 0 0 1 2-2h11v12M16 7h3l3 4v6h-6M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
            { title: 'Factura con IVA', d: 'M9 12h6M9 16h6M9 8h6M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2z' },
            { title: 'Confirmación por email', d: 'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2c2.474 0 4.732.896 6.477 2.382M22 4 12 14l-3-3' },
          ].map((it) => (
            <div key={it.title} className="bg-white px-5 py-6 flex items-center gap-3">
              <svg className="w-5 h-5 text-[#956400] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={it.d} />
              </svg>
              <p className="text-sm font-medium text-[#111111] tracking-tight">{it.title}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
