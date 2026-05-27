import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import type { Database } from "@jurmaq/shared/db-types";

type BarracaCategoriaRow = Pick<
  Database['public']['Tables']['barraca_categorias']['Row'],
  'id' | 'nombre' | 'slug' | 'imagen' | 'padre_id'
>;

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fierro.jpg',
  'fijaciones': '/images/barraca/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/barraca/categorias/herramientas.png',
  'pinturas': '/images/barraca/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/electricidad.png',
  'bano-cocina-y-loggia': '/images/barraca/categorias/Baño.jpg',
  'seguridad-industrial': '/images/barraca/categorias/seguridad.webp',
  'jardin': '/images/barraca/categorias/jardin.png',
  'adhesivos-y-sellantes': '/images/barraca/categorias/adhesivos.webp',
  'cerraduras': '/images/barraca/categorias/cerraduras.jpg',
  'quincalleria': '/images/barraca/categorias/quincasilleria.webp',
  'cercos-y-mallas': '/images/barraca/categorias/mallas.jpg',
  'aridos-y-morteros': '/images/barraca/categorias/morteros.webp',
  'tabiqueria': '/images/barraca/categorias/tabiqueria.png',
  'techumbre': '/images/barraca/categorias/Techumbres.jpg',
  'aditivos-e-impermeabilizantes': '/images/barraca/categorias/impermeabilizante.webp',
  'aislacion': '/images/barraca/categorias/aislacion.webp',
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
  const catIds = (allCats || []).map((c: BarracaCategoriaRow) => c.id);
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
    .filter((c: BarracaCategoriaRow) => !c.padre_id && (c.nombre || '').toLowerCase() !== 'no informado')
    .map((c: BarracaCategoriaRow) => ({
      id: c.id,
      nombre: c.nombre,
      slug: c.slug,
      imagen: c.imagen,
      product_count: productCounts[c.id] || 0,
    }));

  const hijas: SubCategoria[] = (allCats || [])
    .filter(
      (c: BarracaCategoriaRow): c is BarracaCategoriaRow & { padre_id: number } =>
        c.padre_id !== null && (c.nombre || '').toLowerCase() !== 'no informado'
    )
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      slug: c.slug,
      padre_id: c.padre_id,
      product_count: productCounts[c.id] || 0,
    }));

  const subcatsMap = new Map<number, SubCategoria[]>();
  for (const h of hijas) {
    const arr = subcatsMap.get(h.padre_id) || [];
    arr.push(h);
    subcatsMap.set(h.padre_id, arr);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#787774] mb-10">
        <Link href="/" className="hover:text-[#111111] transition-colors">
          Inicio
        </Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[#111111] font-medium">Categorías</span>
      </nav>

      <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
        Barraca · Catálogo
      </p>
      <h1
        className="text-[#111111] tracking-tight mb-3"
        style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
      >
        Todas las{' '}
        <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>
          categorías
        </span>
      </h1>
      <p className="text-[#787774] text-base max-w-2xl mb-12 leading-relaxed">
        Encuentra los materiales que necesitas para tu proyecto.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
        {padres.map((cat) => {
          const subcats = subcatsMap.get(cat.id) || [];
          return (
            <div key={cat.id} className="group">
              <Link href={`/categorias/${cat.slug}`} className="block">
                <div className="aspect-[4/3] bg-[#F7F6F3] relative overflow-hidden rounded-xl border border-[#EAEAEA] mb-3">
                  {getCategoryImage(cat.imagen, cat.slug) ? (
                    <img
                      src={getCategoryImage(cat.imagen, cat.slug)!}
                      alt={cat.nombre}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-[#EAEAEA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <h2 className="text-sm font-medium text-[#111111] leading-tight tracking-tight mb-0.5">
                  {cat.nombre}
                </h2>
                <p className="text-[11px] text-[#787774] tabular-nums">
                  {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
                </p>
              </Link>

              {subcats.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#EAEAEA]">
                  <div className="flex flex-wrap gap-1.5">
                    {subcats.slice(0, 4).map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/categorias/${sub.slug}`}
                        className="inline-flex items-center px-2 py-1 text-[11px] text-[#787774] border border-[#EAEAEA] rounded-full hover:border-[#111111] hover:text-[#111111] transition-colors"
                      >
                        {sub.nombre}
                      </Link>
                    ))}
                    {subcats.length > 4 && (
                      <span className="inline-flex items-center px-2 py-1 text-[11px] text-[#787774]">
                        +{subcats.length - 4}
                      </span>
                    )}
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
