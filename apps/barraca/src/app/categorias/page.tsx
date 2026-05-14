import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/categorias/fierro.jpg',
  'fijaciones': '/images/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/categorias/herramientas.png',
  'pinturas': '/images/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/categorias/electricidad.png',
  'bano-cocina-y-loggia': '/images/categorias/Baño.jpg',
  'seguridad-industrial': '/images/categorias/seguridad.webp',
  'jardin': '/images/categorias/jardin.png',
  'adhesivos-y-sellantes': '/images/categorias/adhesivos.webp',
  'cerraduras': '/images/categorias/cerraduras.jpg',
  'quincalleria': '/images/categorias/quincasilleria.webp',
  'cercos-y-mallas': '/images/categorias/mallas.jpg',
  'aridos-y-morteros': '/images/categorias/morteros.webp',
  'tabiqueria': '/images/categorias/tabiqueria.png',
  'techumbre': '/images/categorias/Techumbres.jpg',
  'aditivos-e-impermeabilizantes': '/images/categorias/impermeabilizante.webp',
  'aislacion': '/images/categorias/aislacion.webp',
};

function getCategoryImage(imagen: string | null, slug: string): string | null {
  if (imagen && imagen.startsWith('/images/barraca/')) return imagen;
  return categoryImages[slug] || imagen || null;
}

export const metadata: Metadata = {
  title: "Categorías · Barraca JURMAQ Curicó · Materiales de Construcción Maule",
  description:
    "Todas las categorías de la Barraca JURMAQ Curicó · Molina: fierros, perfiles, planchas, tubos, mallas Acma, cementos, pinturas, herramientas y más. Súbenos tu cotización y en menos de 2 horas te mejoramos el precio. Despacho a toda la Región del Maule.",
  keywords: [
    "categorías barraca Curicó",
    "categorías materiales construcción Maule",
    "fierros Curicó",
    "perfiles Curicó",
    "planchas zinc Curicó",
    "mallas Acma Maule",
    "pinturas Curicó",
    "te mejoramos el precio",
    "barraca JURMAQ",
  ],
  alternates: {
    canonical: "https://barraca.jurmaq.cl/categorias",
  },
  openGraph: {
    title: "Categorías · Barraca JURMAQ · Te mejoramos el precio en 2h",
    description:
      "Todas las categorías de materiales en Barraca JURMAQ Curicó · Molina: fierros, perfiles, planchas, tubos, mallas, cementos, pinturas. Súbenos tu cotización y te mejoramos el precio en menos de 2 horas.",
    url: "https://barraca.jurmaq.cl/categorias",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      { url: "/barraca/icon-512.png", width: 512, height: 512, alt: "Barraca JURMAQ Curicó · Molina" },
    ],
  },
  icons: {
    icon: [
      { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  imagen: string | null;
  product_count: number;
}

interface SubCategoria {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number;
  product_count: number;
}

export default async function CategoriasPage() {
  // Fetch all active categories
  const { data: allCats } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug, imagen, padre_id')
    .eq('activa', true)
    .order('orden');

  // Get product counts
  const catIds = (allCats || []).map((c: any) => c.id);
  let productCounts: Record<number, number> = {};
  if (catIds.length > 0) {
    const { data: countData } = await supabasePublic
      .from('barraca_productos')
      .select('categoria_id')
      .eq('activo', true)
      .in('categoria_id', catIds);
    if (countData) {
      for (const row of countData) {
        productCounts[row.categoria_id] = (productCounts[row.categoria_id] || 0) + 1;
      }
    }
  }

  const padres: Categoria[] = (allCats || [])
    .filter((c: any) => !c.padre_id && (c.nombre || '').toLowerCase() !== 'no informado')
    .map((c: any) => ({ ...c, product_count: productCounts[c.id] || 0 }));

  const hijas: SubCategoria[] = (allCats || [])
    .filter((c: any) => c.padre_id && (c.nombre || '').toLowerCase() !== 'no informado')
    .map((c: any) => ({ ...c, product_count: productCounts[c.id] || 0 }));

  const subcatsMap = new Map<number, SubCategoria[]>();
  for (const h of hijas) {
    const arr = subcatsMap.get(h.padre_id) || [];
    arr.push(h);
    subcatsMap.set(h.padre_id, arr);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-orange-600 transition-colors">
          Inicio
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy-950 font-medium">Categorias</span>
      </nav>

      <h1 className="text-3xl lg:text-4xl font-bold text-navy-950 mb-2">
        Todas las Categorias
      </h1>
      <p className="text-gray-600 mb-10">
        Encuentra los materiales que necesitas para tu proyecto
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {padres.map((cat) => {
          const subcats = subcatsMap.get(cat.id) || [];
          return (
            <div
              key={cat.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all"
            >
              <Link href={`/categorias/${cat.slug}`}>
                <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
                  {getCategoryImage(cat.imagen, cat.slug) ? (
                    <img
                      src={getCategoryImage(cat.imagen, cat.slug)!}
                      alt={cat.nombre}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                      <svg className="w-12 h-12 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h2 className="text-xl font-bold text-white">
                      {cat.nombre}
                    </h2>
                    <p className="text-sm text-gray-200">
                      {cat.product_count} productos
                    </p>
                  </div>
                </div>
              </Link>

              {subcats.length > 0 && (
                <div className="p-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Subcategorias
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {subcats.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/categorias/${sub.slug}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors"
                      >
                        {sub.nombre}
                        <span className="text-gray-400">({sub.product_count})</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
