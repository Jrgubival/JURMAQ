import 'server-only';
import fs from 'fs';
import path from 'path';

/**
 * Precios locales — SÓLO para revisar una carga de precios en `next dev` sin
 * escribir en la base de producción (PRECIOS_LOCALES=.precios-locales.json).
 *
 * El archivo lo genera `scripts/cargar-precios-web.mjs --local`. Este fetch
 * envuelve las lecturas de barraca_productos y reemplaza precio, tachado,
 * oferta y stock por los del archivo (cruzando por id). Mientras está activo,
 * cualquier escritura a barraca_productos se rechaza, para que nada del admin
 * local llegue a producción mezclado con estos precios.
 *
 * Limitación: los filtros y orden que hace la base (stock > 0, rango y orden
 * por precio) siguen usando los valores de la base; lo que se dibuja usa los
 * del archivo.
 */

type Campos = {
  precio: number | null;
  precio_original: number | null;
  en_oferta: boolean;
  oferta_fin: string | null;
  stock: number;
};

const TABLAS = /\/rest\/v1\/(barraca_productos|barraca_productos_public)(\?|$)/;
const CAMPOS: (keyof Campos)[] = ['precio', 'precio_original', 'en_oferta', 'oferta_fin', 'stock'];

type Mapa = { porId: Map<number, Campos>; porSlug: Map<string, Campos> };

let cache: { ruta: string; mtime: number; mapa: Mapa } | null = null;

function leerMapa(ruta: string): Mapa {
  const mtime = fs.statSync(ruta).mtimeMs;
  if (cache && cache.ruta === ruta && cache.mtime === mtime) return cache.mapa;
  const json = JSON.parse(fs.readFileSync(ruta, 'utf8')) as { productos: Record<string, Campos & { slug?: string }> };
  const entradas = Object.entries(json.productos);
  const mapa: Mapa = {
    porId: new Map(entradas.map(([id, c]) => [Number(id), c])),
    // Hay consultas que no traen el id (p. ej. los metadatos de la ficha): ahí se cruza por slug.
    porSlug: new Map(entradas.filter(([, c]) => c.slug).map(([, c]) => [c.slug as string, c])),
  };
  cache = { ruta, mtime, mapa };
  return mapa;
}

function aplicar(fila: unknown, mapa: Mapa) {
  if (!fila || typeof fila !== 'object') return;
  const f = fila as Record<string, unknown>;
  const c =
    typeof f.id === 'number' ? mapa.porId.get(f.id) : typeof f.slug === 'string' ? mapa.porSlug.get(f.slug) : undefined;
  if (c) for (const k of CAMPOS) if (k in f) f[k] = c[k];
  // Productos anidados en otra consulta: foo(..., barraca_productos(...)).
  const anidado = f.barraca_productos;
  if (Array.isArray(anidado)) anidado.forEach((x) => aplicar(x, mapa));
  else aplicar(anidado, mapa);
}

/** Devuelve un fetch con los precios locales, o undefined si no corresponde. */
export function fetchConPreciosLocales(): typeof fetch | undefined {
  const valor = process.env.PRECIOS_LOCALES?.trim();
  if (!valor) return undefined;
  // Fail-closed: jamás en producción ni en Vercel.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('PRECIOS_LOCALES sólo se permite en desarrollo local');
  }
  const ruta = path.resolve(process.cwd(), valor);
  leerMapa(ruta); // si el archivo no existe, que falle al partir y no en silencio
  console.warn(`[precios-locales] Mostrando los precios de ${ruta} (la base no se toca).`);

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const esProductos = TABLAS.test(url);

    if (esProductos && metodo !== 'GET' && metodo !== 'HEAD') {
      return new Response(
        JSON.stringify({ message: 'Modo PRECIOS_LOCALES: escritura a barraca_productos bloqueada' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    }

    const res = await fetch(input, init);
    const tipo = res.headers.get('content-type') ?? '';
    if (metodo !== 'GET' || !res.ok || !tipo.includes('json')) return res;
    // Sólo nos importan las consultas que traen productos (directas o anidadas).
    if (!esProductos && !decodeURIComponent(url).includes('barraca_productos(')) return res;

    const datos: unknown = await res.json();
    const mapa = leerMapa(ruta);
    if (Array.isArray(datos)) datos.forEach((x) => aplicar(x, mapa));
    else aplicar(datos, mapa);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(JSON.stringify(datos), { status: res.status, statusText: res.statusText, headers });
  };
}
