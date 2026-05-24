import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * /proyectos — Obras JURMAQ destacadas (case studies).
 *
 * Diferenciador: ningún competidor en Chile (Sodimac, Easy, Construmart,
 * Prodalam, Rendalomaq, MTS) muestra obras reales con cliente identificado,
 * máquinas usadas y materiales aplicados. Combina prueba social + cross-sell
 * (clic en la máquina = ficha de arriendo; clic en material = ficha de
 * barraca) en una sola página.
 */

export const metadata: Metadata = {
  title: 'Obras JURMAQ · Proyectos reales en el Maule',
  description:
    'Casos reales: silos Nestlé Teno, bodega de cubas Miguel Torres, expansión Iansagro Linares, y más. Mira las máquinas que arrendamos y los materiales que entregamos en cada obra. +25 años en la Región del Maule.',
  alternates: { canonical: 'https://jurmaq.cl/proyectos' },
  openGraph: {
    title: 'Obras JURMAQ · Proyectos reales en el Maule',
    description:
      'Casos reales: silos Nestlé, bodega cubas Miguel Torres, expansión Iansagro. Maquinaria + materiales en cada obra.',
    url: 'https://jurmaq.cl/proyectos',
    type: 'website',
  },
};

interface Proyecto {
  slug: string;
  titulo: string;
  cliente: string;
  ubicacion: string;
  ano: number;
  monto_uf: number;
  duracion_meses: number;
  descripcion_corta: string;
  descripcion_larga: string;
  maquinarias_usadas: string[];
  materiales_principales: string[];
  destacado: boolean;
  estado: 'completado' | 'en_curso';
}

const PROYECTOS: Proyecto[] = [
  {
    slug: 'silos-nestle-teno',
    titulo: 'Fundaciones y Silos · Nestlé Teno',
    cliente: 'Nestlé Chile',
    ubicacion: 'Planta Nestlé, Teno · Región del Maule',
    ano: 2024,
    monto_uf: 76000,
    duracion_meses: 14,
    descripcion_corta:
      'Fundaciones para silos de granos, expansión de batcheo y molienda, montaje de equipos, pavimentos y movimiento de tierras.',
    descripcion_larga:
      'Obra de gran envergadura para Nestlé Chile en su planta de Teno. Fundaciones especiales para silos de almacenamiento de granos, expansión del área de batcheo y molienda, montaje de equipos industriales y obras de pavimentación. Trabajo coordinado en planta operativa sin interrupción del proceso productivo.',
    maquinarias_usadas: ['Retroexcavadora CAT 420F', 'Camión tolva 14m³', 'Plataforma elevadora 16m', 'Grúa horquilla 3T'],
    materiales_principales: ['Fierro estriado A630', 'Hormigón H-30', 'Malla acma C-188', 'Perfiles metálicos IPE 200'],
    destacado: true,
    estado: 'completado',
  },
  {
    slug: 'bodega-cubas-miguel-torres',
    titulo: 'Bodega de Cubas · Vinícola Miguel Torres',
    cliente: 'Vinícola Miguel Torres',
    ubicacion: 'Curicó · Región del Maule',
    ano: 2023,
    monto_uf: 21000,
    duracion_meses: 8,
    descripcion_corta:
      'Construcción de bodega de cubas, traslado de cubas de 50.000 litros, portería central y obras civiles complementarias.',
    descripcion_larga:
      'Construcción completa de bodega para cubas vinícolas con capacidad de 50.000 litros cada una. Coordinación con producción vinícola sin interrupción del ciclo. Incluyó traslado de cubas, fundaciones especiales, portería central y obras civiles.',
    maquinarias_usadas: ['Brazo articulado 18m', 'Minicargador Bobcat S570', 'Camión grúa 8T'],
    materiales_principales: ['Cemento alta resistencia', 'Acero estructural', 'Planchas zincalum', 'Aislación térmica'],
    destacado: false,
    estado: 'completado',
  },
  {
    slug: 'iansagro-linares',
    titulo: 'Expansión Planta Iansagro Linares',
    cliente: 'Iansagro S.A.',
    ubicacion: 'Linares · Región del Maule',
    ano: 2024,
    monto_uf: 18500,
    duracion_meses: 6,
    descripcion_corta:
      'Expansión área de procesos en planta Iansagro Linares. Fundaciones para nueva línea, pavimentos industriales y montaje estructural.',
    descripcion_larga:
      'Ampliación de planta procesadora con foco en optimizar el flujo productivo. Trabajo coordinado en turnos para no afectar producción de azúcar.',
    maquinarias_usadas: ['Retroexcavadora CAT 416F', 'Miniexcavadora Kubota U35', 'Rodillo compactador 5T'],
    materiales_principales: ['Hormigón H-25', 'Fierro estriado A440', 'Mortero pavimento industrial'],
    destacado: false,
    estado: 'completado',
  },
  {
    slug: 'surfrut-romeral',
    titulo: 'Bodega Refrigerada · Surfrut Romeral',
    cliente: 'Surfrut',
    ubicacion: 'Romeral · Región del Maule',
    ano: 2024,
    monto_uf: 14200,
    duracion_meses: 5,
    descripcion_corta:
      'Construcción de bodega refrigerada de 1.800 m² con cámaras a -25°C para almacenamiento de fruta congelada.',
    descripcion_larga:
      'Bodega refrigerada de gran escala con aislación térmica especial, pisos industriales y muelles de carga. Coordinación con instaladores de refrigeración.',
    maquinarias_usadas: ['Plataforma articulada 22m', 'Camión grúa 10T', 'Minicargador Caterpillar 232D'],
    materiales_principales: ['Paneles aislantes 200mm', 'Pisos epóxicos', 'Hormigón H-30 fibras'],
    destacado: false,
    estado: 'completado',
  },
  {
    slug: 'cbb-cementos-curico',
    titulo: 'Modernización Silos · Cementos Biobío',
    cliente: 'Cementos Biobío (CBB)',
    ubicacion: 'Curicó · Región del Maule',
    ano: 2025,
    monto_uf: 9800,
    duracion_meses: 4,
    descripcion_corta:
      'Modernización de silos de cemento + nueva tolva descarga + obras civiles complementarias.',
    descripcion_larga:
      'Trabajo en operación con planta activa. Refuerzo estructural de silos existentes, instalación de nueva tolva de descarga y obras civiles.',
    maquinarias_usadas: ['Brazo articulado 26m', 'Grúa torre 40m', 'Camión tolva 12m³'],
    materiales_principales: ['Perfiles estructurales', 'Fierro estriado especial', 'Hormigón armado'],
    destacado: false,
    estado: 'en_curso',
  },
];

export default function ProyectosPage() {
  const totalUF = PROYECTOS.reduce((s, p) => s + p.monto_uf, 0);
  const totalObras = PROYECTOS.length;
  const clientes = [...new Set(PROYECTOS.map((p) => p.cliente))].length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Obras destacadas JURMAQ',
    description: 'Proyectos reales de construcción en la Región del Maule.',
    numberOfItems: PROYECTOS.length,
    itemListElement: PROYECTOS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Project',
        name: p.titulo,
        description: p.descripcion_corta,
        provider: { '@type': 'Organization', name: 'JURMAQ' },
        client: { '@type': 'Organization', name: p.cliente },
        location: p.ubicacion,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gold-500 transition-colors">Inicio</Link>
            <span>›</span>
            <span className="text-gray-300">Proyectos</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold text-white mb-4">
            Obras <span className="text-gold-500">reales</span> que hablan por nosotros
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-[60ch] mb-10 leading-relaxed">
            27 años construyendo para las principales empresas agroindustriales del Maule.
            Cada obra incluye qué máquinas usamos y qué materiales entregamos.
          </p>

          {/* Prose-form facts (reemplaza hero-metric template banned por impeccable).
              Números inline en Newsreader italic gold. */}
          <div className="pt-8 border-t border-navy-800 max-w-[58ch] space-y-4 text-base lg:text-lg text-gray-200 leading-relaxed">
            <p>
              <span className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums" style={{ fontWeight: 500 }}>
                {totalObras}
              </span>{' '}
              obras destacadas, ejecutadas para{' '}
              <span className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums" style={{ fontWeight: 500 }}>
                {clientes}
              </span>{' '}
              empresas distintas en la Región del Maule.
            </p>
            <p>
              Monto agregado documentado:{' '}
              <span className="font-[var(--font-serif)] italic text-gold-500 text-[1.45em] align-baseline tabular-nums" style={{ fontWeight: 500 }}>
                UF {(totalUF / 1000).toFixed(0)}K
              </span>
              . Suma neta sin descuentos, verificable en cada caso de obra abajo.
            </p>
          </div>
        </div>
      </section>

      {/* Grid de proyectos */}
      <section className="py-12 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 lg:space-y-8">
            {PROYECTOS.map((p, i) => (
              <article
                key={p.slug}
                className={`group bg-white rounded-2xl overflow-hidden border ${
                  p.destacado ? 'border-gold-500 shadow-lg shadow-gold-500/10' : 'border-gray-200'
                } hover:shadow-xl transition-all`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                  {/* Visual */}
                  <div className="lg:col-span-1 h-64 lg:h-auto bg-gradient-to-br from-navy-900 to-navy-950 relative overflow-hidden">
                    {/* Decorative pattern */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.15) 25%, transparent 25%)',
                        backgroundSize: '30px 30px',
                      }}
                    />
                    {/* Position number */}
                    <div className="absolute top-6 left-6 text-white text-8xl lg:text-9xl font-black opacity-15 leading-none">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    {/* Badge estado */}
                    <div className="absolute top-6 right-6">
                      {p.estado === 'en_curso' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          En curso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                          ✓ Completado
                        </span>
                      )}
                    </div>
                    {/* Año + cliente */}
                    <div className="absolute bottom-6 left-6 right-6 text-white">
                      <p className="text-xs uppercase tracking-widest text-gold-400 font-semibold mb-1">
                        {p.cliente}
                      </p>
                      <p className="text-2xl lg:text-3xl font-extrabold">{p.ano}</p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="lg:col-span-2 p-6 lg:p-8">
                    <h2 className="text-xl lg:text-2xl font-extrabold text-navy-950 mb-2 group-hover:text-gold-600 transition-colors">
                      {p.titulo}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {p.ubicacion}
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-6">{p.descripcion_corta}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pb-5 mb-5 border-b border-gray-100">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Monto</div>
                        <div className="text-lg lg:text-xl font-extrabold text-navy-950 tabular-nums">UF {p.monto_uf.toLocaleString('es-CL')}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Duración</div>
                        <div className="text-lg lg:text-xl font-extrabold text-navy-950 tabular-nums">{p.duracion_meses} meses</div>
                      </div>
                    </div>

                    {/* Maquinarias + Materiales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                          🚜 Maquinarias usadas
                        </div>
                        <ul className="space-y-1">
                          {p.maquinarias_usadas.map((m) => (
                            <li key={m} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-gold-500 shrink-0 mt-0.5">›</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                          🧱 Materiales principales
                        </div>
                        <ul className="space-y-1">
                          {p.materiales_principales.map((mat) => (
                            <li key={mat} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-gold-500 shrink-0 mt-0.5">›</span>
                              <span>{mat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 lg:py-20 bg-gold-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-4">
            ¿Tu obra es la próxima?
          </h2>
          <p className="text-base lg:text-lg text-navy-900 mb-8 max-w-2xl mx-auto">
            Construimos, arrendamos y abastecemos en una sola marca. Cotiza el proyecto completo y
            ahorra tiempo + dinero coordinando con un solo proveedor.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contacto?servicio=constructora"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-navy-950 hover:bg-navy-900 text-white font-bold rounded-xl transition-colors"
            >
              Cotizar mi obra
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/maquinarias"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-navy-950 font-bold rounded-xl transition-colors"
            >
              Ver flota de máquinas
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
