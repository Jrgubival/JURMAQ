/**
 * Familias de variantes: un producto, muchas medidas.
 *
 * El 47% del catálogo activo (939 de 1.977) no son productos distintos sino la
 * misma pieza en otra medida: 50 "Tub Rect Neg", 42 "Oring", 40 "Tub Cuad Neg",
 * 32 "Tub Red Neg", 26 "Canal Negro". Hoy cada una es una tarjeta suelta, así
 * que buscar un tubo de 40x20x2 significa recorrer 50 filas casi idénticas con
 * la misma foto y el mismo título abreviado.
 *
 * Agrupadas, el catálogo navegable baja de 1.977 fichas a ~1.172, y elegir la
 * medida pasa a ser lo que es en el mesón: se pide el tubo y después el
 * espesor.
 *
 * La familia y los ejes se derivan del NOMBRE, que es el único lugar donde el
 * maestro guarda esta información. `producto_padre_id` (que ya existía en la
 * tabla, vacío) apunta cada variante a la de menor id de su familia, que actúa
 * de ancla; así traer las hermanas es una sola consulta indexada en vez de un
 * LIKE sobre 1.977 nombres.
 */

const UNID = String.raw`(?:mm|cm|mts|mt|m|kgs|kg|grs|gr|lts|lt|l|ml|cc|gl|un|bls|pzs|pz|")`;
const NUM = String.raw`\d+(?:\s+\d+/\d+|/\d+|[.,]\d+)?`;

/**
 * Clave de familia: el nombre sin ninguna medida.
 *
 * El `\b` no sirve acá: el maestro escribe "X2.0 MM" pegado y ahí no hay
 * límite de palabra, así que sin los lookbehind "Tub Rect Neg" se partía en
 * tres familias distintas ("tub rect neg 1.", "... 2.", "... 3.").
 */
export function familiaDe(nombre: string): string {
  if (!nombre) return '';
  let s = nombre;
  s = s.replace(new RegExp(`${NUM}\\s*${UNID}\\b`, 'gi'), '');
  s = s.replace(new RegExp(`(?<![A-Za-zÁÉÍÓÚÑ])${NUM}`, 'g'), '');
  s = s.replace(new RegExp(`(?<=[xX×*])${NUM}`, 'g'), '');
  s = s.replace(/\b[xX×*]\b/g, ' ');
  s = s.replace(/[xX×*](?=\s|$)/g, ' ');
  s = s.replace(/[^\wÁÉÍÓÚÑáéíóúñ\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  s = s.replace(/\b(x|de|con|por|y|el|la)\b/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

export interface Eje {
  etiqueta: string;
  valor: string;
}

/**
 * Nombres de eje por tipo de producto.
 *
 * Importa el ORDEN y que cada eje conserve su unidad. Una plancha "1000x3000x3"
 * es 1000 mm de ancho, 3000 de largo y 3 de espesor — etiquetar el 1000 como
 * "espesor" es peor que no etiquetar nada. Y en un tubo redondo "2 1/2 x 3.0mm"
 * el diámetro va en PULGADAS y sólo el espesor en milímetros.
 */
const ETIQUETAS: Array<{ patron: RegExp; ejes: string[]; unidades?: (string | null)[] }> = [
  { patron: /^\s*tub\s+red/i, ejes: ['Diámetro', 'Espesor'], unidades: ['"', 'mm'] },
  { patron: /^\s*tub\s+cuad/i, ejes: ['Lado', 'Espesor'] },
  { patron: /^\s*(tub\s+rect|canal|costanera)/i, ejes: ['Ancho', 'Alto', 'Espesor', 'Largo'] },
  { patron: /^\s*(angulo|pletina|perfil|esquinero)/i, ejes: ['Ancho', 'Alto', 'Espesor'] },
  // Planchas y tableros: ancho × largo × espesor, en ese orden.
  { patron: /^\s*(plancha|zincalum|zinc|terciado|policarbonato|tab\b|osb)/i, ejes: ['Ancho', 'Largo', 'Espesor'] },
  { patron: /^\s*malla/i, ejes: ['Ancho', 'Largo'] },
  { patron: /^\s*oring/i, ejes: ['Diámetro interior', 'Grosor'] },
];

/** Descompone la medida en ejes con nombre, al modo de una ficha técnica. */
export function ejesDe(nombre: string, medida: string | null | undefined): Eje[] {
  const m = (medida || '').trim();
  if (!m) return [];

  const partes = m.split(/\s*x\s*/i).filter(Boolean);
  if (partes.length < 2) return [{ etiqueta: 'Medida', valor: m }];

  // La unidad suele escribirse una sola vez, al final de la cadena.
  const colaUnidad = partes[partes.length - 1].match(new RegExp(`${UNID}\\s*$`, 'i'));
  const unidadComun = colaUnidad ? colaUnidad[0].trim() : '';

  const valores = partes.map((p) => p.replace(new RegExp(`${UNID}\\s*$`, 'i'), '').trim());

  const regla = ETIQUETAS.find((e) => e.patron.test(nombre));
  const etiquetas = regla ? [...regla.ejes] : [];
  while (etiquetas.length < valores.length) etiquetas.push(`Medida ${etiquetas.length + 1}`);

  return valores.map((v, i) => {
    // Si la regla fija una unidad para ese eje, manda esa (el diámetro de un
    // tubo redondo va en pulgadas aunque el espesor vaya en milímetros).
    const propia = regla?.unidades?.[i];
    const u = propia !== undefined && propia !== null ? propia : unidadComun;
    const valor = u === '"' ? `${v}"` : u ? `${v} ${u}` : v;
    return { etiqueta: etiquetas[i], valor };
  });
}

/**
 * Orden numérico de una medida, para que las píldoras salgan 15, 20, 25, 30
 * y no 100, 15, 20 como haría el orden alfabético.
 */
export function valorNumerico(v: string): number {
  const limpio = v.replace(/["\s]*(mm|cm|mts?|m|kg|gr|lts?|l)?\s*$/i, '').trim();
  const mixto = limpio.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixto) return Number(mixto[1]) + Number(mixto[2]) / Number(mixto[3]);
  const frac = limpio.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = parseFloat(limpio.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Título de la familia, legible: "Tub Rect Neg" -> "Tubo rectangular negro". */
const DESABREVIAR: Array<[RegExp, string]> = [
  [/^tub rect neg$/i, 'Tubo rectangular negro'],
  [/^tub cuad neg$/i, 'Tubo cuadrado negro'],
  [/^tub red neg$/i, 'Tubo redondo negro'],
  [/^canal negro$/i, 'Canal negro'],
  [/^angulo doblado negro$/i, 'Ángulo doblado negro'],
  [/^costanera negro$/i, 'Costanera negra'],
  [/^tar clav nyl$/i, 'Tarugo de clavar de nylon'],
  [/^torn/i, 'Tornillo'],
];

export function tituloFamilia(clave: string, ejemplo: string): string {
  for (const [re, txt] of DESABREVIAR) if (re.test(clave)) return txt;
  // Si no hay regla, se usa el nombre del ejemplo recortado antes de la medida.
  const corte = ejemplo.search(/\s\d/);
  const base = (corte > 2 ? ejemplo.slice(0, corte) : ejemplo).trim();
  return base || clave;
}
