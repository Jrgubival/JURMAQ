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
 *
 * Fotos locales (IMAGENES_LOCALES=.imagenes-locales.json): igual, pero sólo
 * reemplaza `imagen`. Lo genera `scripts/corregir-fotos.mjs --local`. Un
 * `imagen: null` es a propósito: deja la placa de medida en vez de la foto.
 */

type Campos = Record<string, unknown>;

const TABLAS = /\/rest\/v1\/(barraca_productos|barraca_productos_public)(\?|$)/;
const CAMPOS_PRECIO = ['precio', 'precio_original', 'en_oferta', 'oferta_fin', 'stock'];
const CAMPOS_IMAGEN = ['imagen'];

type Mapa = { porId: Map<number, Campos>; porSlug: Map<string, Campos> };
type Fuente = { ruta: string; campos: string[] };

const cache = new Map<string, { mtime: number; mapa: Mapa }>();

function leerMapa(ruta: string): Mapa {
  const mtime = fs.statSync(ruta).mtimeMs;
  const previo = cache.get(ruta);
  if (previo && previo.mtime === mtime) return previo.mapa;
  const json = JSON.parse(fs.readFileSync(ruta, 'utf8')) as { productos: Record<string, Campos & { slug?: string }> };
  const entradas = Object.entries(json.productos);
  const mapa: Mapa = {
    porId: new Map(entradas.map(([id, c]) => [Number(id), c])),
    // Hay consultas que no traen el id (p. ej. los metadatos de la ficha): ahí se cruza por slug.
    porSlug: new Map(entradas.filter(([, c]) => c.slug).map(([, c]) => [c.slug as string, c])),
  };
  cache.set(ruta, { mtime, mapa });
  return mapa;
}

function aplicar(fila: unknown, mapa: Mapa, campos: string[]) {
  if (!fila || typeof fila !== 'object') return;
  const f = fila as Record<string, unknown>;
  const c =
    typeof f.id === 'number' ? mapa.porId.get(f.id) : typeof f.slug === 'string' ? mapa.porSlug.get(f.slug) : undefined;
  if (c) for (const k of campos) if (k in f && k in c) f[k] = c[k];
  // Productos anidados en otra consulta: foo(..., barraca_productos(...)).
  const anidado = f.barraca_productos;
  if (Array.isArray(anidado)) anidado.forEach((x) => aplicar(x, mapa, campos));
  else aplicar(anidado, mapa, campos);
}

/** Devuelve un fetch con los precios y/o fotos locales, o undefined si no corresponde. */
export function fetchConPreciosLocales(): typeof fetch | undefined {
  const fuentes: Fuente[] = [];
  for (const [variable, campos] of [
    ['PRECIOS_LOCALES', CAMPOS_PRECIO],
    ['IMAGENES_LOCALES', CAMPOS_IMAGEN],
  ] as const) {
    const valor = process.env[variable]?.trim();
    if (!valor) continue;
    // Fail-closed: jamás en producción ni en Vercel.
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error(`${variable} sólo se permite en desarrollo local`);
    }
    const ruta = path.resolve(process.cwd(), valor);
    leerMapa(ruta); // si el archivo no existe, que falle al partir y no en silencio
    console.warn(`[precios-locales] Mostrando ${variable === 'PRECIOS_LOCALES' ? 'los precios' : 'las fotos'} de ${ruta} (la base no se toca).`);
    fuentes.push({ ruta, campos: [...campos] });
  }
  if (!fuentes.length) return undefined;

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const esProductos = TABLAS.test(url);

    if (esProductos && metodo !== 'GET' && metodo !== 'HEAD') {
      return new Response(
        JSON.stringify({ message: 'Modo PRECIOS_LOCALES/IMAGENES_LOCALES: escritura a barraca_productos bloqueada' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    }

    const res = await fetch(input, init);
    const tipo = res.headers.get('content-type') ?? '';
    if (metodo !== 'GET' || !res.ok || !tipo.includes('json')) return res;
    // Sólo nos importan las consultas que traen productos (directas o anidadas).
    if (!esProductos && !decodeURIComponent(url).includes('barraca_productos(')) return res;

    const datos: unknown = await res.json();
    for (const { ruta, campos } of fuentes) {
      const mapa = leerMapa(ruta);
      if (Array.isArray(datos)) datos.forEach((x) => aplicar(x, mapa, campos));
      else aplicar(datos, mapa, campos);
    }
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(JSON.stringify(datos), { status: res.status, statusText: res.statusText, headers });
  };
}
