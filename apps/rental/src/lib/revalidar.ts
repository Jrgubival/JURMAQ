import 'server-only';
import { revalidatePath } from 'next/cache';
import { fichaHref, type Maquina } from './maquinas';
import { CRUCES_COMUNA_TIPO } from '@/data/comunas';
import { CIUDADES_CON_PAGINA, TIPOS } from './landings';

/**
 * Publica el cambio de una máquina revalidando URLs exactas.
 *
 * Prohibido `revalidatePath('/ruta/[slug]', 'page')`: en la barraca marcaba
 * viejas ~2.000 fichas por cada edición y los bots las regeneraban todas.
 */
export function revalidarMaquina(m: Pick<Maquina, 'id' | 'nombre' | 'tipo'>, nombreAnterior?: string): void {
  const urls = new Set<string>(['/', '/maquinarias', '/arriendo-en/region-del-maule', '/cotizar-arriendo', '/sitemap.xml']);
  urls.add(fichaHref(m));
  if (nombreAnterior && nombreAnterior !== m.nombre) urls.add(fichaHref({ id: m.id, nombre: nombreAnterior }));
  const tipos = TIPOS.filter((t) => t.tipoDb === m.tipo);
  for (const t of tipos) urls.add(`/arriendo/${t.slug}`);
  for (const c of CIUDADES_CON_PAGINA) urls.add(`/arriendo-en/${c}`);
  for (const x of CRUCES_COMUNA_TIPO) {
    if (tipos.some((t) => t.slug === x.tipo)) urls.add(`/arriendo-en/${x.ciudad}/${x.tipo}`);
  }
  for (const url of urls) revalidatePath(url);
}
