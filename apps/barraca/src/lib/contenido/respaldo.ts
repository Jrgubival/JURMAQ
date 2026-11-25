/**
 * RESPALDO EN CÓDIGO: lo que la tienda muestra hoy. Es lo que se usa cuando D1
 * no está, falla, tarda demasiado, está vacía o tiene un valor que no valida.
 * No editar para "cambiar contenido": para eso está la base (herramientas de
 * gestión). Cambiar acá solo si el respaldo mismo debe cambiar.
 *
 * Datos del local: parten de las constantes compartidas (@jurmaq/shared/seo:
 * HQ, LEGAL_INFO, HORARIO_BARRACA), que son el respaldo en código.
 */
import { PRIVACIDAD_MD, TERMINOS_MD } from "./legal-embebido.ts";
import { POPUP_RESPALDO } from "./popup-respaldo.ts";
import { PIE_DESCRIPCION_RESPALDO, datosLocalRespaldo } from "./local-respaldo.ts";
import type { ClaveContenido, ValoresContenido } from "./tipos.ts";

export { datosLocalRespaldo };

export const ENVIOS_MD_RESPALDO = `# Envíos y devoluciones

Resumen de cómo entregamos y cómo devolver. El detalle está en los [Términos y condiciones](/terminos).

## Retiro en el local

Gratis, en {{direccion_corta}}, en horario de atención. Te avisamos cuando el pedido esté listo.

## Despacho en camión

Preparamos el pedido en 1 a 5 días hábiles y te llamamos para coordinar el día de entrega. Despachamos a estas zonas, con el costo que ves en el checkout antes de pagar:

{{tarifas}}

Para otras comunas, escríbenos por WhatsApp y te cotizamos, o retira en Molina.

## Devoluciones (derecho a retracto)

- Puedes arrepentirte dentro de **10 días corridos** desde que recibes o retiras el producto, sin dar una razón.
- Lo devuelves en el local de Molina o, dentro de nuestras zonas de despacho, lo retiramos sin costo para ti.
- El producto tiene que estar sin uso ni deterioro (los materiales de acero, sin cortes, soldaduras ni pintura).
- No tienen retracto los productos abiertos, usados o instalados que no se pueden volver a vender (por ejemplo, cemento o pintura abiertos), ni los cortados a medida. Te lo advertimos antes de pagar.

## Reembolsos

- Webpay: anulamos el cargo en la misma tarjeta. El abono depende de tu banco o emisor.
- Transferencia: te transferimos a la cuenta que nos indiques, de la que seas titular.
- Lo hacemos lo antes posible: si no podemos cumplir un pedido, a más tardar en 10 días hábiles; en el retracto, dentro del plazo legal. Sin cargos ni comisiones.`;

export const NOSOTROS_MD_RESPALDO = `# Quiénes somos

Somos **{{razon_social}}** (RUT {{rut}}), una barraca de fierros y materiales de construcción con local en **{{direccion_corta}}**, Región del Maule.

Vendemos fierro de construcción, perfiles, planchas, tubos, mallas, techumbre, herramientas, pinturas y materiales de obra, para particulares, maestros y empresas. Las empresas pueden pedir factura.

Puedes comprar en el local o en esta tienda en línea, con el precio y el stock de nuestra bodega. Retiras gratis en Molina o te lo llevamos en nuestro camión a {{lugares_despacho}}.

Pagas con tarjeta de débito o crédito en Webpay (Transbank) o por transferencia bancaria a la cuenta de la empresa.`;

export function respaldoDe<K extends ClaveContenido>(clave: K): ValoresContenido[K] {
  return RESPALDOS[clave]() as ValoresContenido[K];
}

const RESPALDOS: { [K in ClaveContenido]: () => ValoresContenido[K] } = {
  terminos: () => ({ texto: TERMINOS_MD.trim() }),
  privacidad: () => ({ texto: PRIVACIDAD_MD.trim() }),
  envios: () => ({ texto: ENVIOS_MD_RESPALDO }),
  nosotros: () => ({ texto: NOSOTROS_MD_RESPALDO }),
  contacto: () => ({
    intro: "Atendemos en el local de Molina, por WhatsApp, por teléfono y por correo.",
    nota: "Para un pedido ya hecho, ten a mano el número (BJ-…) que te llegó por correo.",
  }),
  datos_local: datosLocalRespaldo,
  popup: () => ({ ...POPUP_RESPALDO, botonPrincipal: { ...POPUP_RESPALDO.botonPrincipal }, notaEnlace: POPUP_RESPALDO.notaEnlace ? { ...POPUP_RESPALDO.notaEnlace } : null }),
  slides: () => [
    {
      id: "fachada",
      activa: true,
      imagenDesktop: "/images/barraca/hero/local-fachada.webp",
      imagenMovil: null,
      alt: "Fachada de la Barraca de Fierros JURMAQ en Molina",
      eyebrow: "Barraca de Fierros JURMAQ · Molina",
      titulo: "Fierro, perfiles y materiales, ahora en línea",
      subtitulo: "Compra desde el celular y retira en el local o te lo llevamos.",
      boton: { texto: "Ver productos", enlace: "/categorias" },
      desde: null,
      hasta: null,
      precio: null,
    },
    {
      id: "perfiles",
      activa: true,
      imagenDesktop: "/images/barraca/hero/local-bodega.webp",
      imagenMovil: null,
      alt: "Bodega de planchas y tubos de la Barraca JURMAQ",
      eyebrow: "Perfiles y planchas",
      titulo: "Tubos, ángulos, canales y planchas",
      subtitulo: "Con stock en nuestra bodega de Molina: revisa cada medida en la tienda.",
      boton: { texto: "Ver perfiles", enlace: "/categorias/perfiles-y-planchas" },
      desde: null,
      hasta: null,
      precio: { familia: "tubo", nota: "el tubo de 6 metros" },
    },
    {
      id: "ferreteria",
      activa: true,
      imagenDesktop: "/images/barraca/hero/local-ferreteria.webp",
      imagenMovil: null,
      alt: "Mesón y estanterías de ferretería de la Barraca JURMAQ en Molina",
      eyebrow: "Ferretería",
      titulo: "Todo para la obra en un solo lugar",
      subtitulo: "Fijaciones, herramientas, pinturas, electricidad y más, con precio y stock a la vista.",
      boton: { texto: "Ver categorías", enlace: "/categorias" },
      desde: null,
      hasta: null,
      precio: null,
    },
    {
      id: "despacho",
      activa: true,
      imagenDesktop: "/images/barraca/hero/local-despacho.webp",
      imagenMovil: null,
      alt: "Camión de despacho de la Barraca JURMAQ en el galpón",
      eyebrow: "Despacho",
      titulo: "Despacho a domicilio",
      subtitulo: "Te llamamos para coordinar el día según tu comuna.",
      boton: { texto: "Ver productos", enlace: "/categorias" },
      desde: null,
      hasta: null,
      precio: null,
    },
  ],
  cinta: () => ({ activa: false, texto: "", enlace: null, desde: null, hasta: null }),
  avisos: () => [],
  portada: () => ({
    secciones: [
      { id: "ofertas", visible: true },
      { id: "categorias", visible: true },
      { id: "mas_vendidos", visible: true },
      { id: "fierro_perfiles", visible: true },
      { id: "marcas", visible: true },
    ],
    productosDestacados: [],
    categoriasDestacadas: [],
  }),
  textos: () => ({
    h1: "Barraca de fierros y materiales de construcción en Molina, con despacho a Curicó, Talca y alrededores",
    tituloCategorias: "Categorías",
    tituloMasVendidos: "Los más vendidos",
    tituloFierroPerfiles: "Fierro, perfiles y techumbre",
    tituloMarcas: "Marcas que trabajamos",
    pieDescripcion: PIE_DESCRIPCION_RESPALDO,
  }),
};
