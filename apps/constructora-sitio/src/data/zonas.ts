/**
 * Comunas con página propia: solo donde hay obra documentada. Otra comuna entra
 * cuando exista una obra suya en `obras.ts`. Las retiradas salen en `_redirects`.
 */
export interface Zona {
  slug: string;
  nombre: string;
  tituloSeo: string;
  descripcion: string;
  intro: string;
}

export const ZONAS: Zona[] = [
  {
    slug: "curico",
    nombre: "Curicó",
    tituloSeo: "Constructora en Curicó",
    descripcion:
      "Constructora industrial con base en Maquehua, Curicó. Obras y mantención para Viña Miguel Torres e Iansagro. Cotiza tu obra civil.",
    intro:
      "Nuestra base está en Maquehua, comuna de Curicó. Desde 2000 trabajamos con Viña Miguel Torres, en bodega de cubas, riles y mantención permanente.",
  },
  {
    slug: "teno",
    nombre: "Teno",
    tituloSeo: "Obras civiles en Teno",
    descripcion:
      "Obras civiles y montaje industrial en Teno para Nestlé Chile y Cementos Biobío. Fundaciones, bodegas y mantención en planta activa.",
    intro:
      "En Teno trabajamos desde 2017 en la planta de Nestlé y desde 2002 con Cementos Biobío, con obras dentro de plantas en operación.",
  },
  {
    slug: "romeral",
    nombre: "Romeral",
    tituloSeo: "Obras civiles en Romeral",
    descripcion:
      "Obras civiles y montajes agroindustriales en Romeral para Surfrut: ductos, cámaras, piscinas de fruta y cambio de cubierta.",
    intro:
      "En Romeral ejecutamos para Surfrut ductos, cámaras y piscinas de almacenamiento de fruta, además de cambio de cubierta y montajes estructurales.",
  },
];

export function getZona(slug: string): Zona | undefined {
  return ZONAS.find((z) => z.slug === slug);
}
