import { supabasePublic } from '@jurmaq/shared/supabase';
import { logSafeError } from '@jurmaq/shared/logging';
import { applyDailyPromosToProducts } from '@/lib/promotions';
import { vistaPrecio } from '@/lib/precio-web';
import { describir } from '@/lib/ficha';
import { nombreMarca } from '@/lib/marcas';
import { PRECIO_WEB } from '@/lib/vigencia';

/**
 * GET /feeds/google-merchant.xml — feed de productos para Google Merchant
 * Center (listados gratis en Shopping). Google lo descarga una vez al día.
 *
 * Mismo precio que la ficha y el checkout (vistaPrecio + promociones del día),
 * leído de la base en cada regeneración (cada hora): cuando venza el precio web
 * (PRECIO_WEB.hasta) o cambie un precio, el feed se actualiza solo.
 *   · Sólo productos que se pueden comprar (activo, con stock y precio).
 *   · Sólo con foto propia: la placa genérica de la categoría no es una foto
 *     del producto y Google la rechaza.
 *   · Con precio normal tachado: price = normal y sale_price = web, con la
 *     vigencia del precio web. Sin tachado: price = web.
 *   · Sin GTIN ni código de fabricante reales: identifier_exists = no (el código
 *     de Softmad es interno, no un MPN). El id es el de la tienda (BJ-<id>):
 *     estable aunque un código de Softmad se repita.
 * El envío (Molina gratis) y las devoluciones se configuran en Merchant Center.
 */
export const revalidate = 3600;

const TIENDA = 'https://barraca.jurmaq.cl';
const POR_PAGINA = 1000;

const xml = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clp = (n: number) => `${Math.round(n)} CLP`;

interface FilaFeed {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean | null;
  solo_cotizar: boolean | null;
  stock: number | null;
  unidad: string | null;
  medida: string | null;
  imagen: string | null;
  categoria_id: number | null;
  activo: boolean | null;
  barraca_categorias: { nombre: string | null } | null;
}

async function productos(): Promise<FilaFeed[]> {
  const todos: FilaFeed[] = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabasePublic
      .from('barraca_productos')
      .select('id, codigo, nombre, slug, descripcion, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, medida, imagen, categoria_id, activo, barraca_categorias!left(nombre)')
      .eq('activo', true)
      .gt('stock', 0)
      .order('id')
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw error;
    const filas = (data ?? []) as unknown as FilaFeed[];
    todos.push(...filas);
    if (filas.length < POR_PAGINA) break;
  }
  return todos;
}

function vigencia(): string | null {
  const hasta = PRECIO_WEB.hasta;
  if (!hasta || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
  const desde = PRECIO_WEB.desde && /^\d{4}-\d{2}-\d{2}$/.test(PRECIO_WEB.desde)
    ? PRECIO_WEB.desde
    : new Date().toISOString().slice(0, 10);
  return `${desde}T00:00-03:00/${hasta}T23:59-03:00`;
}

export async function GET() {
  let filas: FilaFeed[];
  try {
    filas = await applyDailyPromosToProducts(await productos());
  } catch (error) {
    logSafeError('feed-merchant-error', { error: String(error) });
    return new Response('No se pudo generar el feed', { status: 503 });
  }
  const periodo = vigencia();

  const items: string[] = [];
  for (const p of filas) {
    if (!p.imagen || !/^https:\/\//.test(p.imagen)) continue;
    const vista = vistaPrecio(p);
    if (!vista.disponible || vista.precioWeb <= 0) continue;
    const marca = nombreMarca(p.nombre);
    const titulo = (p.medida && !p.nombre.toLowerCase().includes(p.medida.toLowerCase()) ? `${p.nombre} ${p.medida}` : p.nombre).slice(0, 150);
    const descripcion = describir({
      nombre: p.nombre,
      medida: p.medida,
      unidad: p.unidad,
      descripcion: p.descripcion,
      categoria_nombre: p.barraca_categorias?.nombre ?? null,
    }).slice(0, 5000);
    const precio = vista.precioNormal
      ? `<g:price>${clp(vista.precioNormal)}</g:price>\n      <g:sale_price>${clp(vista.precioWeb)}</g:sale_price>${periodo ? `\n      <g:sale_price_effective_date>${periodo}</g:sale_price_effective_date>` : ''}`
      : `<g:price>${clp(vista.precioWeb)}</g:price>`;
    items.push(`    <item>
      <g:id>BJ-${p.id}</g:id>
      <g:title>${xml(titulo)}</g:title>
      <g:description>${xml(descripcion)}</g:description>
      <g:link>${TIENDA}/producto/${encodeURIComponent(p.slug)}</g:link>
      <g:image_link>${xml(p.imagen)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      ${precio}
      ${marca ? `<g:brand>${xml(marca)}</g:brand>\n      ` : ''}<g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Hardware &gt; Building Materials</g:google_product_category>
      ${p.barraca_categorias?.nombre ? `<g:product_type>${xml(p.barraca_categorias.nombre)}</g:product_type>` : ''}
    </item>`);
  }

  const cuerpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Barraca de Fierros JURMAQ</title>
    <link>${TIENDA}</link>
    <description>Fierros, perfiles, planchas y materiales de construcción. Retiro en Molina y despacho en camión.</description>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
