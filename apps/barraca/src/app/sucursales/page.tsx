import type { Metadata } from 'next';
import Link from 'next/link';
import { whatsappCtaSucursal } from '@jurmaq/shared/whatsapp';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { LEGAL_INFO, CIUDADES, DISTANCIAS_BARRACA } from '@jurmaq/shared/seo';

/**
 * /sucursales — dónde estamos físicamente y hasta dónde despachamos.
 *
 * ## Por qué esta página se reescribió entera
 *
 * Publicaba CUATRO sucursales: Curicó, Molina, Talca y Linares. La realidad es
 * que la barraca tiene **una sola**, en Molina.
 *
 * Lo que había estaba mal de cuatro formas distintas:
 *
 * 1. La "sucursal Curicó" usaba la dirección de Maquehua, que es la oficina de
 *    la CONSTRUCTORA, no una barraca. Mezclaba dos unidades de negocio.
 * 2. Talca y Linares eran locales inventados, con fecha de apertura
 *    ("Próximamente Q3 2026", "Próximamente 2027").
 * 3. Los cuatro tenían correos que no existen: curico@, molina@, talca@,
 *    linares@jurmaq.cl.
 * 4. Peor: todo eso salía en un JSON-LD `LocalBusiness` con `location[]`, o sea
 *    se le estaba declarando a Google que hay locales físicos donde no los hay.
 *
 * Ahora la página se arma desde `LEGAL_INFO` y `DISTANCIAS_BARRACA` (que son la
 * fuente única y ya estaban correctas: Molina figura a 0 km porque ES la base).
 * Si mañana abre un local de verdad, se agrega en `LEGAL_INFO.brands` y aparece
 * acá solo; no se vuelve a escribir a mano una dirección en una página.
 *
 * El argumento comercial no se pierde: tener un local no es lo que importa para
 * el cliente de Curicó o Talca, sino que le llegue el material. Eso es lo que
 * esta página muestra ahora, con los tiempos reales de despacho.
 */

const BARRACA = LEGAL_INFO.brands.barraca;
const CONSTRUCTORA = LEGAL_INFO.brands.constructora;

const HORARIO_SEMANA = '08:30 — 18:30';
const HORARIO_SABADO = '09:00 — 14:00';

const TITLE = 'Dónde estamos · Barraca en Molina y despacho a todo el Maule · JURMAQ';
const DESCRIPTION =
  'Nuestra barraca de fierros está en Av. Poniente 2157, Molina. Despachamos a Curicó, Teno, Romeral, Sagrada Familia, Talca, Linares y toda la Región del Maule. Horarios, teléfono y WhatsApp directo.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://barraca.jurmaq.cl/sucursales' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://barraca.jurmaq.cl/sucursales',
    locale: 'es_CL',
    type: 'website',
  },
};

/**
 * Ciudades donde despachamos, ordenadas por cercanía real.
 *
 * Sale de `DISTANCIAS_BARRACA`, calculado con OSRM desde Molina — no son
 * números inventados. Se excluye la propia Molina (0 km) porque va aparte como
 * la ubicación física.
 */
function ciudadesDespacho() {
  return CIUDADES
    .map((c) => ({ ...c, d: DISTANCIAS_BARRACA[c.slug] }))
    .filter((c) => c.d && c.d.km > 0)
    .sort((a, b) => a.d!.km - b.d!.km);
}

export default function SucursalesPage() {
  const despacho = ciudadesDespacho();

  // UN solo local. `areaServed` es lo que comunica el alcance real, sin
  // declararle a Google locales que no existen.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HardwareStore',
    // MISMO @id que el del layout raíz (buildJsonLdGraph). Es el mismo local
    // físico: con @ids distintos Google vería dos ferreterías en la misma
    // dirección. Compartiendo el @id, fusiona ambos nodos y se queda con la
    // unión de propiedades — este aporta el detalle de comunas de despacho.
    '@id': 'https://barraca.jurmaq.cl/#localbusiness',
    name: BARRACA.nombre,
    url: 'https://barraca.jurmaq.cl/sucursales',
    telephone: BARRACA.telefono,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BARRACA.streetAddress,
      addressLocality: BARRACA.addressLocality,
      addressRegion: BARRACA.addressRegion,
      postalCode: BARRACA.postalCode,
      addressCountry: BARRACA.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BARRACA.geo.latitude,
      longitude: BARRACA.geo.longitude,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:30',
        closes: '18:30',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '09:00',
        closes: '14:00',
      },
    ],
    areaServed: despacho.map((c) => ({
      '@type': 'City',
      name: c.nombre,
      address: {
        '@type': 'PostalAddress',
        addressLocality: c.nombre,
        addressRegion: 'Región del Maule',
        addressCountry: 'CL',
      },
    })),
  };

  const mapsQuery = encodeURIComponent(`${BARRACA.streetAddress}, ${BARRACA.addressLocality}, Chile`);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <nav aria-label="Migas de pan" className="text-xs text-gray-500">
            <Link href="/" className="hover:text-navy-950 transition-colors">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">Dónde estamos</span>
          </nav>

          <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-navy-950 leading-tight">
            Estamos en Molina y despachamos a todo el Maule
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">
            Tenemos un local: la barraca de fierros en Molina. Desde ahí sale el
            despacho a Curicó, Talca, Linares y el resto de la región.
          </p>
        </div>
      </div>

      {/* ── El local ─────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-xl border border-gray-300 bg-white overflow-hidden">
            <div className="bg-navy-950 px-6 py-4">
              <p className="text-[11px] uppercase tracking-widest text-orange-400 font-semibold">
                Nuestro local
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">{BARRACA.nombre}</h2>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-6">
              <div>
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Dirección</dt>
                    <dd className="mt-0.5 font-medium text-navy-950">
                      {BARRACA.direccion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Horario</dt>
                    <dd className="mt-0.5 text-navy-950">
                      <span className="font-medium">Lun a Vie</span> {HORARIO_SEMANA}
                      <br />
                      <span className="font-medium">Sábado</span> {HORARIO_SABADO}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Contacto</dt>
                    <dd className="mt-0.5 text-navy-950">
                      <a
                        href={`tel:${BARRACA.telefono}`}
                        className="font-medium hover:text-orange-600 transition-colors"
                      >
                        {BARRACA.telefonoDisplay}
                      </a>
                      <br />
                      <a
                        href="mailto:contacto@jurmaq.cl"
                        className="hover:text-orange-600 transition-colors"
                      >
                        contacto@jurmaq.cl
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-2.5 sm:justify-center">
                <a
                  href={whatsappCtaSucursal('Molina', { slug: 'molina' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                >
                  Escribir por WhatsApp
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 hover:border-navy-950 text-navy-950 font-semibold rounded-lg transition-colors"
                >
                  Ver en Google Maps
                </a>
                <Link
                  href="/cotizar"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-navy-950 hover:bg-navy-900 text-white font-semibold rounded-lg transition-colors"
                >
                  Cotizar con despacho
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Despacho ─────────────────────────────────────────────────────── */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-navy-950">Hasta dónde despachamos</h2>
          <p className="mt-3 text-gray-600 max-w-2xl leading-relaxed">
            Tiempos estimados de viaje desde Molina con camión cargado. No
            necesitas ir al local: cotizas online y te llega a la obra.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm min-w-[26rem]">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-2 font-semibold text-navy-950">Comuna</th>
                  <th className="pb-2 font-semibold text-navy-950">Distancia</th>
                  <th className="pb-2 font-semibold text-navy-950">Tiempo estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {despacho.map((c) => (
                  <tr key={c.slug}>
                    <td className="py-2.5 font-medium text-navy-950">{c.nombre}</td>
                    <td className="py-2.5 text-gray-600">{c.d!.km} km</td>
                    <td className="py-2.5 text-gray-600">{c.d!.tiempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            El costo de despacho depende del volumen y la distancia; se calcula
            al cotizar.
          </p>
        </div>
      </div>

      {/* ── La otra unidad ───────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-lg font-bold text-navy-950">
            ¿Buscabas la constructora o el arriendo de maquinaria?
          </h2>
          <p className="mt-2 text-gray-600 max-w-2xl leading-relaxed">
            Son otra unidad de JURMAQ y operan desde la oficina en{' '}
            {CONSTRUCTORA.addressLocality} ({CONSTRUCTORA.streetAddress}), no
            desde la barraca.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://constructora.jurmaq.cl"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 hover:border-navy-950 text-navy-950 font-semibold rounded-lg text-sm transition-colors"
            >
              Obras civiles →
            </a>
            <a
              href="https://jurmaq.cl/maquinarias"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 hover:border-navy-950 text-navy-950 font-semibold rounded-lg text-sm transition-colors"
            >
              Arriendo de maquinaria →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
