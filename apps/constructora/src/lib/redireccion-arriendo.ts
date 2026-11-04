/**
 * El arriendo se mudó a rental.jurmaq.cl. Cada URL vieja de jurmaq.cl responde
 * 301 directo a una página que existe allá (sin cadenas ni 404), para traspasar
 * el posicionamiento. Devuelve la ruta de destino, o null si no es del arriendo.
 */
export const ARRIENDO_HOST = 'rental.jurmaq.cl';

const COMUNAS = new Set(['curico', 'molina', 'teno', 'romeral', 'sagrada-familia', 'hualane', 'licanten', 'vichuquen', 'rauco', 'talca', 'linares', 'constitucion']);
const TIPOS = new Set(['retroexcavadora', 'miniexcavadora', 'minicargador', 'brazo-articulado', 'plataforma-elevadora', 'camion-tolva', 'alzahombre']);
/** Únicas páginas comuna × tipo que existen en rental. */
const COMUNAS_CON_TIPO = new Set(['curico', 'molina', 'talca']);
const TIPOS_CON_COMUNA = new Set(['retroexcavadora', 'miniexcavadora', 'minicargador', 'brazo-articulado', 'camion-tolva', 'alzahombre']);
const FICHAS: Record<string, string> = {
  '1': 'retroexcavadora-hmk-102b-1',
  '2': 'miniexcavadora-xcmg-xe35u-2',
  '3': 'brazo-articulado-jlg-e450aj-3',
  '4': 'plataforma-elevadora-fullen-psc140-4',
  '5': 'minicargador-bobcat-s650-5',
  '6': 'camion-tolva-vw-constellation-31-260e-6',
  '7': 'plataforma-elevadora-genie-gs-1930-7',
  '9': 'minicargador-bobcat-s570-9',
};

export function destinoArriendo(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (p === '/maquinarias' || p === '/como-funciona' || p === '/cotizar-arriendo' || p === '/recursos' || p.startsWith('/recursos/')) return p;

  // /maquinarias/<id>, /maquinarias/<slug>-<id> y /maquinarias/<slug>-<id>/en/<comuna>
  if (p.startsWith('/maquinarias/')) {
    const id = p.match(/^\/maquinarias\/(?:.*-)?(\d+)(?:\/en\/[a-z-]+)?$/)?.[1];
    const ficha = id ? FICHAS[id] : undefined;
    return ficha ? `/maquinarias/${ficha}` : '/maquinarias';
  }

  if (p === '/arriendo') return '/maquinarias';
  if (p.startsWith('/arriendo/')) {
    const tipo = p.slice('/arriendo/'.length);
    return TIPOS.has(tipo) ? p : '/maquinarias';
  }

  if (p === '/arriendo-en' || p === '/arriendo-en/region-del-maule') return '/arriendo-en/region-del-maule';
  if (p.startsWith('/arriendo-en/')) {
    const [comuna, tipo] = p.slice('/arriendo-en/'.length).split('/');
    if (!COMUNAS.has(comuna)) return '/arriendo-en/region-del-maule';
    if (tipo && COMUNAS_CON_TIPO.has(comuna) && TIPOS_CON_COMUNA.has(tipo)) return `/arriendo-en/${comuna}/${tipo}`;
    return `/arriendo-en/${comuna}`;
  }
  return null;
}
