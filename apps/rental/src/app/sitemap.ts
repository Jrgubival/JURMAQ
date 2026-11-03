import type { MetadataRoute } from 'next';
import { RECURSOS } from '@/data/recursos';
import { obtenerFlota } from '@/lib/flota';
import { CIUDADES_RENTAL, TIPOS } from '@/lib/landings';
import { fichaHref } from '@/lib/maquinas';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const flota = await obtenerFlota();
  const rutas = [
    '',
    '/maquinarias',
    '/cotizar-arriendo',
    '/como-funciona',
    '/contacto',
    '/recursos',
    '/arriendo-en/region-del-maule',
    ...flota.map(fichaHref),
    ...TIPOS.map((t) => `/arriendo/${t.slug}`),
    ...CIUDADES_RENTAL.map((c) => `/arriendo-en/${c.slug}`),
    ...RECURSOS.map((r) => `/recursos/${r.slug}`),
  ];
  return rutas.map((r) => ({ url: `${SITIO.url}${r}` }));
}
