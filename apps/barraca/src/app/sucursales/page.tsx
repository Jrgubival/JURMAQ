import type { Metadata } from 'next';
import Link from 'next/link';
import { whatsappCtaSucursal } from '@jurmaq/shared/whatsapp';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

/**
 * /sucursales — Página pública con 4 sucursales JURMAQ.
 *
 * Diferenciador: hasta ahora barraca.jurmaq.cl no tenía página de sucursales.
 * Los competidores (Prodalam, Sodimac) sí la tienen, pero la nuestra agrega:
 * - WhatsApp directo por sucursal (no solo teléfono)
 * - Stock por sucursal (próximo sprint)
 * - Horario en vivo (sabemos si está abierto ahora)
 * - Especialidad por sucursal (Curicó tiene todo, Molina foco maquinaria, etc.)
 */

export const metadata: Metadata = {
  title: 'Sucursales JURMAQ · Curicó · Molina · Talca · Linares',
  description:
    'Visita nuestras 4 sucursales en la Región del Maule. Dirección, horarios, teléfono y WhatsApp directo por sucursal. Atención en obra para Curicó, Teno, Molina, Romeral, Sagrada Familia, Talca, Linares y todo el Maule.',
  alternates: { canonical: 'https://barraca.jurmaq.cl/sucursales' },
};

interface Sucursal {
  slug: string;
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  whatsapp: string;
  email: string;
  horario_semana: string;
  horario_sabado: string;
  lat: number;
  lng: number;
  especialidad: string;
  destacada: boolean;
}

const SUCURSALES: Sucursal[] = [
  {
    slug: 'curico',
    nombre: 'JURMAQ Curicó',
    ciudad: 'Curicó',
    direccion: 'Lt 3 del Lt A, Hj 11, Maquehua, Curicó',
    telefono: '+56976673577',
    whatsapp: '56976673577',
    email: 'curico@jurmaq.cl',
    horario_semana: '08:30 — 18:30',
    horario_sabado: '09:00 — 14:00',
    lat: -34.9833,
    lng: -71.2333,
    especialidad: 'Casa matriz — Catálogo completo barraca + arriendo + maestranza',
    destacada: true,
  },
  {
    slug: 'molina',
    nombre: 'JURMAQ Molina',
    ciudad: 'Molina',
    direccion: 'Av. Poniente 2157, Molina',
    telefono: '+56976673577',
    whatsapp: '56976673577',
    email: 'molina@jurmaq.cl',
    horario_semana: '08:30 — 18:30',
    horario_sabado: '09:00 — 14:00',
    lat: -35.1167,
    lng: -71.2833,
    especialidad: 'Foco arriendo maquinaria pesada · Despacho a Romeral, Sagrada Familia',
    destacada: false,
  },
  {
    slug: 'talca',
    nombre: 'JURMAQ Talca',
    ciudad: 'Talca',
    direccion: 'Próximamente — Talca centro',
    telefono: '+56976673577',
    whatsapp: '56976673577',
    email: 'talca@jurmaq.cl',
    horario_semana: 'Próximamente Q3 2026',
    horario_sabado: '—',
    lat: -35.4264,
    lng: -71.6554,
    especialidad: 'Sucursal en planificación — Atendemos Talca desde Curicó por ahora',
    destacada: false,
  },
  {
    slug: 'linares',
    nombre: 'JURMAQ Linares',
    ciudad: 'Linares',
    direccion: 'Próximamente — Linares',
    telefono: '+56976673577',
    whatsapp: '56976673577',
    email: 'linares@jurmaq.cl',
    horario_semana: 'Próximamente 2027',
    horario_sabado: '—',
    lat: -35.8462,
    lng: -71.5972,
    especialidad: 'En evaluación — atendemos Linares desde Curicó/Molina',
    destacada: false,
  },
];

function isOpenNow(suc: Sucursal): boolean {
  if (suc.horario_semana.startsWith('Próximamente')) return false;
  const now = new Date();
  // Chile timezone (CLT/CLST). Approx: UTC-3 (verano) o UTC-4 (invierno).
  // Para producción real, usar Intl.DateTimeFormat con America/Santiago.
  const day = now.getDay(); // 0=dom, 6=sáb
  const hour = now.getHours();
  if (day === 0) return false;
  if (day === 6) return hour >= 9 && hour < 14;
  return hour >= 8 && hour < 18;
}

export default function SucursalesPage() {
  const sucursalesData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'JURMAQ — Sucursales',
    branchOf: { '@id': 'https://barraca.jurmaq.cl/#organization' },
    location: SUCURSALES.filter((s) => !s.direccion.includes('Próximamente')).map((s) => ({
      '@type': 'LocalBusiness',
      name: s.nombre,
      address: { '@type': 'PostalAddress', streetAddress: s.direccion, addressLocality: s.ciudad, addressCountry: 'CL' },
      telephone: s.telefono,
      email: s.email,
      geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(sucursalesData) }}
      />

      {/* Hero */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/" className="hover:text-orange-400 transition-colors">Inicio</Link>
            <span>›</span>
            <span className="text-gray-300">Sucursales</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold text-white mb-3">
            Sucursales <span className="text-orange-500">JURMAQ</span> en el Maule
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl">
            2 sucursales activas + 2 en planificación. Cubrimos despacho a toda la Región del Maule.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="py-12 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {SUCURSALES.map((suc) => {
              const isAvailable = !suc.direccion.includes('Próximamente');
              const open = isOpenNow(suc);
              return (
                <div
                  key={suc.slug}
                  className={`relative bg-white rounded-2xl border ${
                    suc.destacada
                      ? 'border-orange-500 shadow-lg shadow-orange-500/10'
                      : 'border-gray-200'
                  } overflow-hidden hover:shadow-xl transition-shadow`}
                >
                  {suc.destacada && (
                    <div className="absolute top-4 right-4 z-10 px-2.5 py-1 bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Casa Matriz
                    </div>
                  )}

                  {/* Map placeholder con gradient */}
                  <div className="h-40 bg-gradient-to-br from-navy-800 to-navy-950 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }} />
                    <div className="absolute bottom-3 left-4 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-white text-xs font-semibold">
                        {suc.ciudad} · {suc.lat.toFixed(3)}, {suc.lng.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 lg:p-7">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="text-xl lg:text-2xl font-bold text-navy-950">{suc.nombre}</h2>
                      {isAvailable && (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${
                            open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          {open ? 'Abierto ahora' : 'Cerrado'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-5 leading-relaxed">{suc.especialidad}</p>

                    <div className="space-y-3 text-sm border-t border-gray-100 pt-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-gray-700">{suc.direccion}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <div className="text-gray-700"><span className="font-medium">L-V:</span> {suc.horario_semana}</div>
                          {suc.horario_sabado !== '—' && (
                            <div className="text-gray-700"><span className="font-medium">Sáb:</span> {suc.horario_sabado}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAvailable && (
                      <div className="grid grid-cols-2 gap-2 mt-5">
                        <a
                          href={`tel:${suc.telefono}`}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-navy-950 hover:bg-navy-950 hover:text-white text-navy-950 font-bold text-sm rounded-lg transition-colors"
                        >
                          📞 Llamar
                        </a>
                        <a
                          href={whatsappCtaSucursal(suc.ciudad, { phone: suc.whatsapp })}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Despacho */}
      <section className="py-12 bg-navy-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">
            Despachamos a <span className="text-orange-500">toda la Región del Maule</span>
          </h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Curicó · Teno · Molina · Romeral · Sagrada Familia · Hualañé · Licantén · Vichuquén ·
            Rauco · Talca · Linares · Constitución · Cauquenes
          </p>
          <Link
            href="/te-mejoramos-el-precio"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors"
          >
            Te mejoramos el precio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
