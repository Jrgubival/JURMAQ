import type { Module, Action } from '../roles';

/**
 * Menú ÚNICO del panel de administración de JURMAQ.
 *
 * ## El problema que resuelve
 *
 * Había dos paneles separados: `jurmaq.cl/admin` (arriendo, contratos,
 * tributario) y `barraca.jurmaq.cl/admin` (productos, precios, promociones).
 * Cada uno con su propio sidebar y su propia mitad del negocio, así que para
 * ver todo había que saber en cuál de los dos estaba cada cosa y saltar entre
 * dominios a mano.
 *
 * Ahora los dos shells pintan ESTA lista completa. Desde cualquiera de los dos
 * se ve y se alcanza todo; el salto de dominio es transparente porque la
 * cookie de sesión es `Domain=.jurmaq.cl` y vale en ambos.
 *
 * ## Por qué el código sigue en dos apps
 *
 * Las páginas admin de barraca consumen `/api/productos`, `/api/categorias` y
 * `/api/cotizaciones`, que son las MISMAS rutas que usa la tienda pública.
 * Moverlas a la app de constructora rompería la tienda, y duplicarlas dejaría
 * dos implementaciones del mismo endpoint divergiendo con el tiempo. Se separa
 * entonces la experiencia (un solo menú) de la ubicación física del código.
 *
 * ## Cómo agregar una sección
 *
 * Se agrega acá y aparece en los dos shells. No edites los arrays locales de
 * cada app: ya no existen.
 */

/** A qué app pertenece físicamente la ruta. Determina el host del link. */
export type AdminApp = 'constructora' | 'barraca';

/**
 * Grupos del sidebar, en orden de aparición.
 *
 * Agrupados por cómo piensa el negocio —"lo del arriendo" / "lo de la
 * barraca"— y no por detalle técnico, que era el problema del menú anterior.
 */
export type AdminNavGroup =
  | 'Inicio'
  | 'Arriendo y obras'
  | 'Barraca'
  | 'Tributario'
  | 'Sistema';

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  'Inicio',
  'Arriendo y obras',
  'Barraca',
  'Tributario',
  'Sistema',
];

export interface AdminNavItem {
  label: string;
  /** Path dentro de su app, siempre empezando en `/admin`. */
  path: string;
  app: AdminApp;
  module: Module;
  /**
   * Acción que exige la API detrás de la pantalla. Por defecto 'read'.
   *
   * Filtrar solo por módulo mostraba entradas que terminaban en 403: un
   * operador veía "Plantillas contrato" y la API exige `manage_templates`.
   */
  action?: Action;
  group: AdminNavGroup;
  /** Palabras extra para el buscador (Cmd+K). */
  keywords?: string[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  // ── Inicio ────────────────────────────────────────────────────────────────
  { label: 'Dashboard', path: '/admin', app: 'constructora', module: 'dashboard', group: 'Inicio' },

  // ── Arriendo y obras ──────────────────────────────────────────────────────
  {
    label: 'Cotizaciones',
    path: '/admin/cotizaciones-arriendo',
    app: 'constructora',
    module: 'cotizaciones',
    group: 'Arriendo y obras',
    keywords: ['cotizar', 'arriendo', 'cot-ar'],
  },
  { label: 'Contratos', path: '/admin/contratos', app: 'constructora', module: 'contratos', group: 'Arriendo y obras', keywords: ['firma'] },
  { label: 'Solicitudes', path: '/admin/solicitudes', app: 'constructora', module: 'solicitudes', group: 'Arriendo y obras' },
  { label: 'Maquinarias', path: '/admin/maquinarias', app: 'constructora', module: 'maquinarias', group: 'Arriendo y obras' },
  { label: 'Rentabilidad', path: '/admin/reportes/rentabilidad', app: 'constructora', module: 'cotizaciones', group: 'Arriendo y obras', keywords: ['reporte', 'margen'] },
  { label: 'Garantías', path: '/admin/garantias', app: 'constructora', module: 'contratos', group: 'Arriendo y obras', keywords: ['klap', 'deposito'] },
  { label: 'Clientes', path: '/admin/clientes', app: 'constructora', module: 'clientes', group: 'Arriendo y obras' },

  // ── Barraca ───────────────────────────────────────────────────────────────
  { label: 'Cotizaciones barraca', path: '/admin/cotizaciones', app: 'barraca', module: 'barraca_cotizaciones', group: 'Barraca', keywords: ['pedidos', 'ventas'] },
  { label: 'Productos', path: '/admin/productos', app: 'barraca', module: 'barraca_productos', group: 'Barraca', keywords: ['catalogo', 'sku'] },
  { label: 'Categorías', path: '/admin/categorias', app: 'barraca', module: 'barraca_categorias', group: 'Barraca' },
  { label: 'Precios', path: '/admin/precios', app: 'barraca', module: 'barraca_precios', group: 'Barraca', keywords: ['margen', 'costo'] },
  { label: 'Promociones', path: '/admin/promociones', app: 'barraca', module: 'barraca_promociones', group: 'Barraca', keywords: ['oferta', 'descuento'] },
  { label: 'Cupones', path: '/admin/cupones', app: 'barraca', module: 'barraca_promociones', group: 'Barraca' },
  { label: 'Imágenes', path: '/admin/imagenes', app: 'barraca', module: 'barraca_imagenes', group: 'Barraca', keywords: ['fotos'] },
  { label: 'Importar', path: '/admin/importar', app: 'barraca', module: 'barraca_importar', group: 'Barraca', keywords: ['excel', 'carga masiva', 'inventario'] },
  { label: 'Reviews', path: '/admin/reviews', app: 'barraca', module: 'barraca_reviews', group: 'Barraca', keywords: ['resenas', 'opiniones'] },
  { label: 'Suscriptores', path: '/admin/suscriptores', app: 'barraca', module: 'barraca_suscriptores', group: 'Barraca', keywords: ['newsletter', 'correos'] },

  // ── Tributario ────────────────────────────────────────────────────────────
  { label: 'Combustible', path: '/admin/combustible', app: 'constructora', module: 'combustible', group: 'Tributario', keywords: ['iec', 'facturas', 'petroleo'] },
  { label: 'Tarifas IEC', path: '/admin/combustible/tarifas', app: 'constructora', module: 'combustible', group: 'Tributario' },
  { label: 'SII / F29', path: '/admin/sii', app: 'constructora', module: 'combustible', group: 'Tributario', keywords: ['iva', 'tributario', 'f29'] },

  // ── Sistema ───────────────────────────────────────────────────────────────
  { label: 'Usuarios', path: '/admin/usuarios', app: 'constructora', module: 'usuarios', group: 'Sistema', keywords: ['roles', 'permisos', 'trabajadores'] },
  { label: 'Plantillas de contrato', path: '/admin/contratos/templates', app: 'constructora', module: 'contratos', action: 'manage_templates', group: 'Sistema' },
  { label: 'Cola de emails', path: '/admin/email-queue', app: 'constructora', module: 'usuarios', group: 'Sistema', keywords: ['correo', 'envios'] },
  { label: 'Notificaciones', path: '/admin/notificaciones', app: 'constructora', module: 'dashboard', group: 'Sistema' },
  { label: 'Diagnóstico OTP', path: '/admin/sistema/otp', app: 'constructora', module: 'usuarios', group: 'Sistema', keywords: ['sms', 'verificacion'] },
];

/**
 * URL final de un item según desde qué app se está renderizando.
 *
 * Mismo app → path relativo (navegación cliente de Next, sin recarga).
 * Otro app  → URL absoluta al otro host. La sesión viaja porque la cookie es
 * `Domain=.jurmaq.cl`.
 *
 * `hosts` permite inyectar los orígenes; en desarrollo conviene pasar los
 * localhost para no saltar a producción.
 */
export function adminHref(
  item: AdminNavItem,
  desde: AdminApp,
  hosts?: Partial<Record<AdminApp, string>>
): string {
  if (item.app === desde) return item.path;
  const base =
    hosts?.[item.app] ??
    (item.app === 'barraca' ? 'https://barraca.jurmaq.cl' : 'https://jurmaq.cl');
  return `${base.replace(/\/$/, '')}${item.path}`;
}

/** True si el item apunta al otro dominio (para marcarlo en la UI). */
export function esExterno(item: AdminNavItem, desde: AdminApp): boolean {
  return item.app !== desde;
}
