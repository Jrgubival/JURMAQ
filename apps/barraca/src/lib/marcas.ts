/**
 * Marcas del catálogo de la barraca.
 *
 * El maestro de productos no trae columna de marca: viene del sistema del
 * mesón, donde la marca —cuando importa— va escrita dentro del nombre
 * ("Alicate Cortante 6 Tolmat", "Broca Paleta 1 1/2 UYUS"). Este módulo es la
 * única fuente de verdad para reconocerla.
 *
 * Dos cosas que no son obvias y que costó descubrir:
 *
 * 1. Buena parte del catálogo NO tiene marca y eso es correcto, no un dato
 *    faltante: un ángulo doblado negro de 40x40 o un tarugo de nylon son
 *    commodities que la barraca compra a quien tenga stock. Por eso la UI
 *    muestra la marca cuando existe y la línea de categoría cuando no, en vez
 *    de rotular "Genérico" — que en una barraca se lee como "producto malo".
 *
 * 2. Varias palabras que parecen marca son tipo de producto. "Llave Corona" es
 *    una llave de boca cerrada, no la marca Corona; "Broca Paleta" es una broca
 *    plana; "Chaleco Geólogo" es un tipo de chaleco. Confundirlas llenaba el
 *    filtro de marcas fantasma que no filtran nada.
 */

export interface Marca {
  /** Nombre para mostrar, con su tilde y mayúsculas correctas. */
  nombre: string;
  /** Identificador estable para URLs y filtros. */
  slug: string;
  /** Patrones que la reconocen dentro del nombre del producto. */
  patrones: RegExp[];
}

/** Marcas presentes en el catálogo, verificadas una a una contra los nombres. */
export const MARCAS: Marca[] = [
  { nombre: 'Uyustools', slug: 'uyustools', patrones: [/\bUYUS(TOOLS)?\b/i, /\bUyu\(/i] },
  { nombre: 'Praga', slug: 'praga', patrones: [/\bPraga\b/i] },
  { nombre: 'Würth', slug: 'wurth', patrones: [/\bW[üu]rth\b/i] },
  { nombre: 'Tolmat', slug: 'tolmat', patrones: [/\bTolmat\b/i] },
  { nombre: 'Volcán', slug: 'volcan', patrones: [/\bVOLCANITA\b/i, /\bVolc[áa]n\b/i] },
  { nombre: 'Lioi', slug: 'lioi', patrones: [/\bLioi\b/i] },
  { nombre: 'Rex', slug: 'rex', patrones: [/\bRex\b/i] },
  { nombre: 'Keaton', slug: 'keaton', patrones: [/\bKeaton\b/i] },
  { nombre: 'Truper', slug: 'truper', patrones: [/\bTruper\b/i] },
  { nombre: 'W-Max', slug: 'w-max', patrones: [/\bW[- ]?max\b/i] },
  { nombre: 'Mec', slug: 'mec', patrones: [/\bMec\s*\d{3,4}\b/i, /\bMec\b(?!\w)/i] },
  { nombre: 'Passol', slug: 'passol', patrones: [/\bPassol\b/i] },
  { nombre: 'Valkolor', slug: 'valkolor', patrones: [/\bValkolor\b/i] },
  { nombre: 'Chilco', slug: 'chilco', patrones: [/\bChilco\b/i] },
  { nombre: 'Condecora', slug: 'condecora', patrones: [/\bCondecora\b/i] },
  { nombre: 'Soso', slug: 'soso', patrones: [/\bSoso\b/i] },
  { nombre: 'Taumm', slug: 'taumm', patrones: [/\bTaumm\b/i] },
  { nombre: 'Vinilit', slug: 'vinilit', patrones: [/\bVinilit\b/i] },
  { nombre: 'Km', slug: 'km', patrones: [/\bBroca\s+SDS\s+Km\b/i] },
  { nombre: 'Soquina', slug: 'soquina', patrones: [/\bSoquina\b/i] },
  { nombre: 'Stretto', slug: 'stretto', patrones: [/\bStre?tto\b/i] },
  { nombre: 'Tigre', slug: 'tigre', patrones: [/\bTigre\b/i] },
  { nombre: 'Bahco', slug: 'bahco', patrones: [/\bBahco\b/i] },
  { nombre: 'Galvatec', slug: 'galvatec', patrones: [/\bGalvatec\b/i] },
  { nombre: 'Weber', slug: 'weber', patrones: [/\bWEBER\b/i] },
  { nombre: 'Titan', slug: 'titan', patrones: [/\bTitan\b/i] },
  { nombre: 'Ferretools', slug: 'ferretools', patrones: [/\bFerretools\b/i] },
  { nombre: 'WD-40', slug: 'wd-40', patrones: [/\bWD[- ]?40\b/i] },
  { nombre: 'Polpaico', slug: 'polpaico', patrones: [/\bPolpaico\b/i] },
  { nombre: 'Delta', slug: 'delta', patrones: [/\bCinta de Embalaje Delta\b/i] },
  { nombre: 'Acan', slug: 'acan', patrones: [/\bZinc\s+Acan\b/i] },
  { nombre: 'Hoffens', slug: 'hoffens', patrones: [/\bHoffens\b/i] },
  { nombre: 'Patel', slug: 'patel', patrones: [/\bPatel\b/i] },
];

/*
 * Marcas que a propósito NO están en la lista de arriba:
 *   · 3M   → el catálogo sólo tiene "Alargador 3m", donde 3m son tres metros.
 *   · Melón → sólo aparece en "Esmalte Al Agua Melon", que es el color melón.
 *   · Sika, Bosch, Lavoro, Danmi → cero productos en el catálogo actual.
 * Un patrón que matchea una medida o un color no agrega una marca: mete ruido
 * en el filtro y rotula mal la ficha.
 */

/**
 * Palabras que parecen marca pero son el tipo de producto.
 *
 * "Llave Corona 12mm" es una llave de boca cerrada; "Broca Paleta" es una broca
 * plana; "Chaleco Geólogo" es un modelo de chaleco; "Perno Coche" es un perno
 * de cabeza redonda. Ninguna es marca, y tratarlas como tal metía al filtro
 * marcas que no existen.
 */
const FALSAS_MARCAS = /\b(Llave\s+Corona|Broca\s+Paleta|Atornillador\s+Paleta|Chaleco\s+Ge[óo]logo|Perno\s+Coche|Disco\s+Flap|Llave\s+Punta\s+Corona)\b/i;

/** Devuelve la marca del producto, o null si no tiene una identificable. */
export function detectarMarca(nombre: string): Marca | null {
  if (!nombre) return null;
  const limpio = nombre.replace(FALSAS_MARCAS, ' ');
  for (const m of MARCAS) {
    if (m.patrones.some((p) => p.test(limpio))) return m;
  }
  return null;
}

/** Sólo el nombre para mostrar, que es lo que necesita la mayoría de las vistas. */
export function nombreMarca(nombre: string): string | null {
  return detectarMarca(nombre)?.nombre ?? null;
}

export function marcaPorSlug(slug: string): Marca | null {
  return MARCAS.find((m) => m.slug === slug) ?? null;
}
