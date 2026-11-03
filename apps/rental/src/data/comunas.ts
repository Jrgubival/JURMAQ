/**
 * Texto propio de cada comuna. Sólo rubros públicos de la zona y lo que Jorge
 * confirmó: sin obras, clientes ni cifras que no estén respaldados.
 * `maquinas` ordena la flota según lo que más se pide para esos trabajos.
 */
export interface ComunaRental {
  slug: string;
  nombre: string;
  intro: string;
  trabajos: string[];
  maquinas: string[];
  nota?: string;
}

export const COMUNAS: ComunaRental[] = [
  {
    slug: 'curico',
    nombre: 'Curicó',
    intro: 'Nuestra base está en Maquehua, dentro de la comuna. Aquí se cruzan bodegas agroindustriales, vitivinícolas, comercio y construcción habitacional.',
    trabajos: ['Fundaciones de bodegas y galpones', 'Zanjas para redes de agua y alcantarillado', 'Mantención en altura en plantas y bodegas'],
    maquinas: ['retroexcavadora', 'minicargador', 'alzahombre', 'brazo_articulado', 'miniexcavadora', 'camion'],
  },
  {
    slug: 'molina',
    nombre: 'Molina',
    intro: 'Comuna de viñas y agroindustria frutícola, conectada con la Ruta 5 Sur. Muchas obras ocurren dentro de predios y plantas en funcionamiento.',
    trabajos: ['Caminos interiores y nivelación en predios', 'Limpieza y carga en patios agroindustriales', 'Excavación entre hileras y espacios estrechos'],
    maquinas: ['miniexcavadora', 'minicargador', 'retroexcavadora', 'camion', 'alzahombre', 'brazo_articulado'],
  },
  {
    slug: 'teno',
    nombre: 'Teno',
    intro: 'Comuna frutícola con packing, bodegaje y obras rurales. El trabajo suele repartirse entre patios de carga y predios agrícolas.',
    trabajos: ['Patios y accesos para packing', 'Zanjas de riego y redes rurales', 'Carga y retiro de material en predios'],
    maquinas: ['retroexcavadora', 'camion', 'minicargador', 'miniexcavadora', 'brazo_articulado', 'alzahombre'],
  },
  {
    slug: 'romeral',
    nombre: 'Romeral',
    intro: 'Comuna precordillerana con agroindustria, turismo rural y proyectos de regadío, donde el acceso a la obra pesa tanto como la máquina.',
    trabajos: ['Movimiento de tierras para regadío', 'Accesos y plataformas en terreno irregular', 'Limpieza de canales y predios'],
    maquinas: ['retroexcavadora', 'miniexcavadora', 'camion', 'minicargador', 'brazo_articulado', 'alzahombre'],
  },
  {
    slug: 'sagrada-familia',
    nombre: 'Sagrada Familia',
    intro: 'Zona agrícola y vitivinícola, con sectores como Lontué. Obras de infraestructura rural y plantas que requieren trabajo en altura.',
    trabajos: ['Trabajo en altura en plantas y bodegas', 'Conservación de caminos rurales', 'Excavación para instalaciones en predios'],
    maquinas: ['brazo_articulado', 'alzahombre', 'retroexcavadora', 'minicargador', 'camion', 'miniexcavadora'],
  },
  {
    slug: 'hualane',
    nombre: 'Hualañé',
    intro: 'En el valle del Mataquito, camino a la costa. Combina caminos rurales, agricultura y viviendas en sectores apartados.',
    trabajos: ['Mantención de caminos', 'Excavación para viviendas rurales', 'Carga y traslado de áridos'],
    maquinas: ['retroexcavadora', 'camion', 'minicargador', 'miniexcavadora', 'alzahombre', 'brazo_articulado'],
    nota: 'Ya hemos arrendado máquinas para trabajos en Hualañé.',
  },
  {
    slug: 'licanten',
    nombre: 'Licantén',
    intro: 'Comuna costera y forestal, junto a la desembocadura del Mataquito. Los caminos forestales y agrícolas marcan buena parte del trabajo.',
    trabajos: ['Caminos forestales y agrícolas', 'Drenajes y zanjas', 'Retiro de material en sectores rurales'],
    maquinas: ['retroexcavadora', 'camion', 'minicargador', 'miniexcavadora', 'brazo_articulado', 'alzahombre'],
  },
  {
    slug: 'vichuquen',
    nombre: 'Vichuquén',
    intro: 'Comuna turística, con construcción habitacional en torno al lago y a Iloca. Muchas obras tienen accesos angostos y temporadas marcadas.',
    trabajos: ['Fundaciones en terrenos con poco acceso', 'Excavación para casas y cabañas', 'Mejoramiento de caminos interiores'],
    maquinas: ['miniexcavadora', 'minicargador', 'retroexcavadora', 'camion', 'alzahombre', 'brazo_articulado'],
  },
  {
    slug: 'rauco',
    nombre: 'Rauco',
    intro: 'Comuna agrícola del valle central, con fruticultura intensiva. Abundan las obras menores dentro de los predios.',
    trabajos: ['Zanjas de riego', 'Galpones y fundaciones menores', 'Limpieza y carga en huertos'],
    maquinas: ['miniexcavadora', 'minicargador', 'retroexcavadora', 'camion', 'alzahombre', 'brazo_articulado'],
  },
  {
    slug: 'talca',
    nombre: 'Talca',
    intro: 'Capital regional y mayor centro urbano del Maule. Construcción inmobiliaria, comercio, obra pública y mantención de edificios.',
    trabajos: ['Excavación para edificación', 'Trabajo en altura en fachadas y locales', 'Carga y retiro de escombros'],
    maquinas: ['brazo_articulado', 'retroexcavadora', 'camion', 'alzahombre', 'minicargador', 'miniexcavadora'],
  },
  {
    slug: 'linares',
    nombre: 'Linares',
    intro: 'Centro agroindustrial del sur de la región, junto a la Ruta 5. Para esta distancia conviene coordinar con tiempo el traslado.',
    trabajos: ['Obras en plantas agroindustriales', 'Movimiento de tierras', 'Arriendos por semana o mes'],
    maquinas: ['retroexcavadora', 'camion', 'brazo_articulado', 'minicargador', 'miniexcavadora', 'alzahombre'],
  },
  {
    slug: 'constitucion',
    nombre: 'Constitución',
    intro: 'Comuna costera con actividad forestal e industrial. Por distancia, suele convenir arrendar por períodos más largos.',
    trabajos: ['Infraestructura costera y portuaria menor', 'Caminos y accesos forestales', 'Mantención industrial en altura'],
    maquinas: ['brazo_articulado', 'retroexcavadora', 'camion', 'minicargador', 'alzahombre', 'miniexcavadora'],
  },
];

/**
 * Combinaciones que se mantienen vivas. La lista final sale de Search Console:
 * toda URL con impresiones o clics se agrega aquí antes de publicar.
 */
const BASE = ['curico', 'molina', 'talca'];
const TIPOS_BASE = ['retroexcavadora', 'miniexcavadora', 'minicargador', 'camion-tolva', 'brazo-articulado', 'alzahombre'];
export const CRUCES_COMUNA_TIPO: { ciudad: string; tipo: string }[] = BASE.flatMap((ciudad) => TIPOS_BASE.map((tipo) => ({ ciudad, tipo })));
