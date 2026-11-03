import 'server-only';
import { revalidatePath } from 'next/cache';
import { fichaHref, type Maquina } from './maquinas';
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
  const tipo = TIPOS.find((t) => t.tipoDb === m.tipo);
  if (tipo) urls.add(`/arriendo/${tipo.slug}`);
  for (const c of CIUDADES_CON_PAGINA) urls.add(`/arriendo-en/${c}`);
  for (const url of urls) revalidatePath(url);
}
