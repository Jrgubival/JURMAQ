/**
 * Contenido editable de la tienda (términos, popup, slides, datos del local...).
 * Tipos compartidos por el servidor, la tienda y las herramientas de gestión.
 * Sin dependencias de Next ni de React: se prueba directo con node --test.
 *
 * Reglas de oro (docs/MCP-NOTAS.md, sección "Contenido editable"):
 *   - Si D1 falla, no existe o está vacía, la tienda muestra EXACTAMENTE lo que
 *     hoy está escrito en código (respaldo.ts).
 *   - Todo texto editable pasa por saneamiento (markdown.ts): sin HTML, sin
 *     scripts, enlaces solo https o rutas internas, imágenes solo nuestras.
 */

export const CLAVES_CONTENIDO = [
  "terminos",
  "privacidad",
  "envios",
  "nosotros",
  "contacto",
  "datos_local",
  "popup",
  "slides",
  "cinta",
  "avisos",
  "portada",
  "textos",
] as const;

export type ClaveContenido = (typeof CLAVES_CONTENIDO)[number];

export function esClaveContenido(x: unknown): x is ClaveContenido {
  return typeof x === "string" && (CLAVES_CONTENIDO as readonly string[]).includes(x);
}

/** Documento de texto largo en markdown seguro (términos, privacidad, envíos, nosotros). */
export interface DocumentoMd {
  texto: string;
}

/** Textos de /contacto (los datos salen de datos_local). */
export interface ContactoTextos {
  intro: string;
  nota: string;
}

export const DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export interface Tramo {
  /** "HH:MM" 24 horas. */
  abre: string;
  cierra: string;
}

/** Horario por día; un día sin tramos está cerrado. */
export type HorarioSemanal = Record<DiaSemana, Tramo[]>;

/**
 * UNA sola fuente para teléfono, WhatsApp, dirección y horario: de acá salen
 * header, pie, contacto, botones flotantes, mensajes de WhatsApp, schema.org
 * (LocalBusiness) y metadatos.
 */
export interface DatosLocal {
  nombre: string;
  razonSocial: string;
  rut: string;
  /** Dirección en una línea ("Av. Poniente 2157, Molina, Maule"). */
  direccion: string;
  calle: string;
  comuna: string;
  region: string;
  codigoPostal: string;
  /** E.164 con "+" (+56976673577). */
  telefono: string;
  telefonoDisplay: string;
  /** Solo dígitos con código de país (56976673577), el que pide wa.me. */
  whatsapp: string;
  email: string;
  instagram: string;
  geo: { lat: number; lng: number };
  horario: HorarioSemanal;
}

export interface BotonContenido {
  texto: string;
  /** https o ruta interna ("/categorias"). */
  enlace: string;
}

export interface PopupConfig {
  activo: boolean;
  /** Ruta interna o URL de nuestro bucket. Vacío = sin foto. */
  imagen: string;
  titular: string;
  texto: string;
  botonPrincipal: BotonContenido;
  botonSecundario: string;
  nota: string;
  notaEnlace: BotonContenido | null;
  /** ISO con zona, o "AAAA-MM-DDTHH:MM" (hora de Chile). null = sin límite. */
  desde: string | null;
  hasta: string | null;
  /** Cada cuántos días vuelve a salir tras cerrarlo. */
  cadaDias: number;
}

export interface SlidePrecio {
  familia: "fierro" | "tubo" | "zinc";
  nota: string;
}

export interface SlideConfig {
  id: string;
  activa: boolean;
  imagenDesktop: string;
  /** Si falta, se usa la de escritorio también en el celular. */
  imagenMovil: string | null;
  alt: string;
  eyebrow: string;
  titulo: string;
  subtitulo: string;
  boton: BotonContenido | null;
  desde: string | null;
  hasta: string | null;
  /** Muestra "desde $X" con el precio real de la familia (lo calcula el servidor). */
  precio: SlidePrecio | null;
}

export interface CintaConfig {
  activa: boolean;
  texto: string;
  enlace: BotonContenido | null;
  desde: string | null;
  hasta: string | null;
}

export const TIPOS_AVISO = ["cierre", "feriado", "despacho", "otro"] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];
export const SEVERIDADES_AVISO = ["info", "aviso", "alerta"] as const;
export type SeveridadAviso = (typeof SEVERIDADES_AVISO)[number];
export const LUGARES_AVISO = ["tienda", "carrito", "checkout"] as const;
export type LugarAviso = (typeof LUGARES_AVISO)[number];

export interface AvisoConfig {
  id: string;
  activo: boolean;
  tipo: TipoAviso;
  severidad: SeveridadAviso;
  titulo: string;
  texto: string;
  desde: string | null;
  hasta: string | null;
  /** Dónde se ve. Solo informa: nunca bloquea una compra. */
  donde: LugarAviso[];
}

export const SECCIONES_PORTADA = ["ofertas", "categorias", "mas_vendidos", "fierro_perfiles", "marcas"] as const;
export type SeccionPortada = (typeof SECCIONES_PORTADA)[number];

export interface PortadaConfig {
  /** Orden y visibilidad de las secciones bajo el carrusel. */
  secciones: { id: SeccionPortada; visible: boolean }[];
  /** Códigos de producto de "Los más vendidos" (vacío = el ranking actual). */
  productosDestacados: string[];
  /** Slugs de categoría del carrusel de círculos (vacío = las 10 con más productos). */
  categoriasDestacadas: string[];
}

/** Otros textos destacados de la portada y del pie. */
export interface TextosPortada {
  h1: string;
  tituloCategorias: string;
  tituloMasVendidos: string;
  tituloFierroPerfiles: string;
  tituloMarcas: string;
  pieDescripcion: string;
}

export interface ValoresContenido {
  terminos: DocumentoMd;
  privacidad: DocumentoMd;
  envios: DocumentoMd;
  nosotros: DocumentoMd;
  contacto: ContactoTextos;
  datos_local: DatosLocal;
  popup: PopupConfig;
  slides: SlideConfig[];
  cinta: CintaConfig;
  avisos: AvisoConfig[];
  portada: PortadaConfig;
  textos: TextosPortada;
}

/** Metadatos fijos de cada tipo de contenido. */
export interface MetaContenido {
  etiqueta: string;
  /** Publicar necesita la aprobación de Jorge (el borrador es libre). */
  requiereAprobacion: boolean;
  /** Páginas que se regeneran al publicar (revalidatePath). "/" con tipo layout = toda la tienda. */
  paginas: { ruta: string; tipo?: "page" | "layout" }[];
}

export const META_CONTENIDO: Record<ClaveContenido, MetaContenido> = {
  terminos: { etiqueta: "Términos y condiciones", requiereAprobacion: true, paginas: [{ ruta: "/terminos" }] },
  privacidad: { etiqueta: "Política de privacidad", requiereAprobacion: true, paginas: [{ ruta: "/privacidad" }] },
  envios: { etiqueta: "Envíos y devoluciones", requiereAprobacion: false, paginas: [{ ruta: "/envios-y-devoluciones" }] },
  nosotros: { etiqueta: "Quiénes somos", requiereAprobacion: false, paginas: [{ ruta: "/nosotros" }] },
  contacto: { etiqueta: "Textos de contacto", requiereAprobacion: false, paginas: [{ ruta: "/contacto" }] },
  // Los datos del local salen en todas las páginas (pie, JSON-LD): se regenera toda la tienda.
  datos_local: { etiqueta: "Datos del local (teléfono, dirección, horario)", requiereAprobacion: false, paginas: [{ ruta: "/", tipo: "layout" }] },
  // Popup, cinta y avisos se leen por /api/contenido/publico (no van en el HTML): no regeneran páginas.
  popup: { etiqueta: "Popup de la tienda", requiereAprobacion: false, paginas: [] },
  slides: { etiqueta: "Carrusel de la portada", requiereAprobacion: false, paginas: [{ ruta: "/" }] },
  cinta: { etiqueta: "Cinta superior", requiereAprobacion: false, paginas: [] },
  avisos: { etiqueta: "Avisos de cierre, feriados y despacho", requiereAprobacion: false, paginas: [] },
  portada: { etiqueta: "Orden de la portada", requiereAprobacion: false, paginas: [{ ruta: "/" }] },
  textos: { etiqueta: "Textos destacados de la portada y el pie", requiereAprobacion: false, paginas: [{ ruta: "/", tipo: "layout" }] },
};

/**
 * Campos de datos_local que mandan al cliente a hablar o pagar a otro lado: cambiarlos
 * necesita la aprobación de Jorge (WhatsApp, teléfono, correo, dirección y RUT). Nombre,
 * Instagram y horario son libres.
 */
export const CAMPOS_LOCAL_SENSIBLES = [
  "rut", "razonSocial", "direccion", "calle", "comuna", "region", "codigoPostal", "telefono", "telefonoDisplay", "whatsapp", "email", "geo",
] as const;

/** ¿Publicar este valor (frente a lo que se ve hoy) necesita la aprobación de Jorge? */
export function publicacionRequiereAprobacion(clave: ClaveContenido, actual: unknown, nuevo: unknown): boolean {
  if (META_CONTENIDO[clave].requiereAprobacion) return true;
  if (clave !== "datos_local") return false;
  const a = (actual ?? {}) as Record<string, unknown>;
  const n = (nuevo ?? {}) as Record<string, unknown>;
  return CAMPOS_LOCAL_SENSIBLES.some((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(n[k] ?? null));
}

/** Quien hace el cambio (viene de la sesión validada, nunca del texto del usuario). */
export interface UsuarioContenido {
  id: string;
  email?: string | null;
}

export type ResultadoValidacion<T> = { ok: true; valor: T } | { ok: false; errores: string[] };
