/**
 * Descripción y especificaciones de un producto, derivadas de lo que el
 * catálogo realmente sabe.
 *
 * Los 2.338 productos tienen `descripcion` en NULL: el maestro viene del
 * sistema del mesón, que guarda código, nombre, precio y stock, y nada más.
 *
 * La salida fácil sería generar 2.338 párrafos de relleno. No se hace, por dos
 * razones concretas: se notan a la tercera ficha —es exactamente el "look de
 * plantilla" que hay que evitar— y, peor, un texto inventado sobre calidades
 * de acero, normas o garantías es una afirmación comercial que nadie verificó.
 *
 * Entonces acá sólo se afirma lo que se puede leer del propio producto: su
 * tipo, su medida, su terminación, su marca, cómo se vende y para qué sirve su
 * categoría. Si un dato no está, la frase que lo mencionaba no se escribe.
 *
 * `descripcion` en la base sigue mandando: si alguien escribe una descripción
 * a mano en el panel, esa gana. Esto es el piso, no el techo.
 */

import { nombreMarca } from './marcas';

export interface ProductoFicha {
  nombre: string;
  medida?: string | null;
  unidad?: string | null;
  descripcion?: string | null;
  categoria_nombre?: string | null;
  stock?: number | null;
}

/**
 * Para qué sirve cada categoría, escrito a mano.
 *
 * Son 19 frases y son la parte que evita que todas las fichas suenen igual:
 * una plantilla sin esto produce 1.978 variaciones de "producto de calidad
 * para tu proyecto". Cada una dice algo que un maestro reconocería.
 */
const CONTEXTO_CATEGORIA: Record<string, string> = {
  'Fijaciones':
    'Pieza de fijación: sujeta, une o ancla dos elementos. En la barraca se vende suelta y por cantidad, así que conviene calcular con holgura antes de subir al andamio.',
  'Herramientas y Maq':
    'Herramienta de trabajo para obra o taller. Se entrega tal como viene de fábrica, sin armado previo.',
  'Pinturas':
    'Producto de terminación y protección de superficies. El rendimiento por litro depende de la absorción del muro y de cuántas manos se apliquen.',
  'Perfiles y Planchas':
    'Perfil de acero de largo estándar, de los que se usan para estructura, portones, rejas y techumbre. Se vende la barra completa.',
  'Baño Cocina y Loggia':
    'Artículo de gasfitería y terminación para baño, cocina o loggia. Las medidas de cañería siguen el estándar en pulgadas.',
  'Electricidad e Iluminacion':
    'Material eléctrico para instalación domiciliaria. La instalación la debe hacer un instalador autorizado SEC.',
  'Fierros Construccion':
    'Fierro para hormigón armado. Se vende la barra de largo estándar y se despacha cortado a pedido si se acuerda antes.',
  'Seguridad Industrial':
    'Elemento de protección personal para obra. Revisar la talla antes de comprar: no se cambia una vez usado.',
  'Jardin':
    'Artículo para riego, jardín y exterior. Pensado para intemperie.',
  'Adhesivos y Sellantes':
    'Adhesivo o sellante. El rendimiento y el tiempo de fragüe dependen de la temperatura y de que la superficie esté limpia y seca.',
  'Quincalleria':
    'Quincallería de uso general: las piezas chicas que resuelven una instalación y que siempre faltan a media obra.',
  'Cerraduras':
    'Cerradura o herraje de puerta. Conviene medir el espesor de la puerta y la distancia al canto antes de comprar.',
  'Cercos y Mallas':
    'Malla o cerco para cierre perimetral. Se vende por rollo o por metro según el formato.',
  'Techumbre':
    'Material de techumbre. Considerar el traslapo entre planchas al calcular la cantidad: siempre se necesita más superficie que la del techo.',
  'Aridos y Morteros':
    'Árido, cemento o mortero seco. Se vende por saco y rinde según la dosificación que use la obra.',
  'Tabiqueria':
    'Material para tabique y cielo en seco. Se instala sobre estructura de perfiles.',
  'Aditivos e Impermeabilizantes':
    'Aditivo o impermeabilizante para mezcla y superficies. Se dosifica según indicación del fabricante.',
  'Aislacion':
    'Material de aislación térmica o acústica. El espesor define el rendimiento.',
};

/** Terminaciones y materiales que el propio nombre declara. */
const MATERIALES: Array<[RegExp, string]> = [
  [/\binox(idable)?\b/i, 'en acero inoxidable'],
  [/\bgalvaniz\w*/i, 'galvanizado'],
  [/\bzincad\w*/i, 'zincado'],
  [/\blaton\w*/i, 'latonado'],
  [/\bbronce\b/i, 'de bronce'],
  [/\balumini\w*/i, 'de aluminio'],
  [/\bcobre\b/i, 'de cobre'],
  [/\bnyl(on)?\b\.?/i, 'de nylon'],
  [/\bPPR\b/i, 'de PPR'],
  [/\bPVC\b/i, 'de PVC'],
  [/\bacero\b/i, 'de acero'],
  [/\b(negro|negra|neg)\b/i, 'en acabado negro'],
];

/** Abreviaturas del maestro, en el idioma con que se piden en el mesón. */
const ABREVIATURAS: Array<[RegExp, string]> = [
  [/^Tub\s+Rect\s+Neg\b/i, 'Tubo rectangular negro'],
  [/^Tub\s+Cuad\s+Neg\b/i, 'Tubo cuadrado negro'],
  [/^Tub\s+Red\s+Neg\b/i, 'Tubo redondo negro'],
  [/^Tub\b/i, 'Tubo'],
  [/^Torn\b\.?/i, 'Tornillo'],
  [/^Tar\.?\s*clav\.?\s*nyl\.?/i, 'Tarugo de clavar de nylon'],
  [/^P\.\s*Hex\b/i, 'Perno hexagonal'],
];

/** Cómo se vende, leído de la unidad y del propio nombre. */
function formaDeVenta(p: ProductoFicha): string | null {
  const pack = p.nombre.match(/\b(\d+)\s*(un|bls|pzs?|pack)\b/i);
  if (pack) {
    const n = pack[1];
    const envase = /bls/i.test(pack[2]) ? 'bolsa' : 'paquete';
    return `Se vende por ${envase} de ${n} unidades.`;
  }
  const u = (p.unidad || '').trim().toUpperCase();
  if (u === 'KG') return 'Se vende por kilo.';
  if (u === 'MT') return 'Se vende por metro.';
  if (u === 'JG') return 'Se vende por juego.';
  return null;
}

/** El tipo de producto: las primeras palabras del nombre, ya desabreviadas. */
function tipoProducto(nombre: string): string {
  let t = nombre;
  for (const [re, txt] of ABREVIATURAS) {
    if (re.test(t)) {
      t = t.replace(re, txt);
      break;
    }
  }
  // cortar en el primer número: lo que sigue es medida, no el tipo
  const corte = t.search(/\s\d|\s[-–]|\(/);
  const tipo = (corte > 0 ? t.slice(0, corte) : t).trim();
  return tipo.length > 2 ? tipo : nombre.trim();
}

function materialDe(nombre: string): string | null {
  for (const [re, txt] of MATERIALES) if (re.test(nombre)) return txt;
  return null;
}

/**
 * Normaliza la medida para leerla en prosa: el maestro la guarda en mayúscula
 * pegada ("9MM 30X45") y dentro de una frase eso grita.
 */
function medidaLegible(m: string): string {
  return m
    .replace(/\b(\d+(?:[.,]\d+)?)\s*X\s*/gi, '$1 x ')
    // sin \b por delante: el maestro escribe '9MM' pegado y ahí no hay límite
    // de palabra entre el número y la unidad.
    .replace(/(MM|CM|MTS|MT|KG|GR|ML|CC)\b/g, (u) => u.toLowerCase())
    .replace(/\b(L|M|W|V|A)\b/g, (u) => u.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Descripción del producto. Devuelve la escrita a mano si existe; si no, la
 * arma con los datos que hay. Nunca inventa normas, calidades ni garantías.
 */
export function describir(p: ProductoFicha): string {
  const manual = (p.descripcion || '').trim();
  if (manual) return manual;

  const partes: string[] = [];

  // 1. Qué es, cuánto mide, de qué es y de qué marca.
  const tipo = tipoProducto(p.nombre);
  const material = materialDe(p.nombre);
  const marca = nombreMarca(p.nombre);
  let frase = tipo;
  if (p.medida) frase += ` de ${medidaLegible(p.medida)}`;
  // El material sólo se agrega si el nombre no lo dijo ya: "Abrazadera Manguera
  // Zincada ... zincado" y "Tubo ... negro ... en acabado negro" se leen como
  // texto generado, que es justo lo que hay que evitar.
  if (material) {
    const palabra = material.replace(/^(de|en acabado|en)\s+/, '');
    if (!new RegExp(palabra.slice(0, 5), 'i').test(tipo)) frase += ` ${material}`;
  }
  // Lo mismo con la marca: si ya viene en el nombre, no se repite.
  if (marca && !new RegExp(`\\b${marca.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`, 'i').test(tipo)) {
    frase += `, marca ${marca}`;
  }
  partes.push(frase.replace(/\s+/g, ' ').trim() + '.');

  // 2. Para qué sirve, según su categoría.
  const ctx = p.categoria_nombre ? CONTEXTO_CATEGORIA[p.categoria_nombre] : null;
  if (ctx) partes.push(ctx);

  // 3. Cómo se vende, si no es la unidad suelta de siempre.
  const venta = formaDeVenta(p);
  if (venta) partes.push(venta);

  return partes.join(' ');
}

/** Filas de la tabla de especificaciones: sólo las que tienen valor real. */
export function especificaciones(
  p: ProductoFicha & { codigo?: string | null },
): Array<{ etiqueta: string; valor: string }> {
  const filas: Array<{ etiqueta: string; valor: string }> = [];
  const marca = nombreMarca(p.nombre);
  if (marca) filas.push({ etiqueta: 'Marca', valor: marca });
  if (p.medida) filas.push({ etiqueta: 'Medida', valor: p.medida });
  const material = materialDe(p.nombre);
  if (material) {
    filas.push({
      etiqueta: 'Material / terminación',
      valor: material.replace(/^(de|en)\s+/, '').replace(/^\w/, (c) => c.toUpperCase()),
    });
  }
  const pack = p.nombre.match(/\b(\d+)\s*(un|bls|pzs?|pack)\b/i);
  if (pack) filas.push({ etiqueta: 'Unidades por envase', valor: pack[1] });
  if (p.unidad && p.unidad.trim()) {
    const u = p.unidad.trim().toUpperCase();
    const legible: Record<string, string> = { UN: 'Por unidad', KG: 'Por kilo', MT: 'Por metro', JG: 'Por juego' };
    filas.push({ etiqueta: 'Se vende', valor: legible[u] || u });
  }
  if (p.codigo) filas.push({ etiqueta: 'Código', valor: p.codigo });
  return filas;
}
