/**
 * Validación y saneamiento estrictos de cada tipo de contenido. Puro.
 * `validarContenido(clave, entrada)` devuelve el valor LIMPIO (textos saneados,
 * enlaces e imágenes comprobados, campos desconocidos descartados) o la lista
 * de errores en español. Todo lo que entra a D1 pasa por acá; todo lo que sale
 * de D1 hacia la tienda también (si no valida, la tienda usa el respaldo).
 */
import {
  DIAS_SEMANA,
  LUGARES_AVISO,
  SECCIONES_PORTADA,
  SEVERIDADES_AVISO,
  TIPOS_AVISO,
  type AvisoConfig,
  type BotonContenido,
  type CintaConfig,
  type ClaveContenido,
  type ContactoTextos,
  type DatosLocal,
  type DocumentoMd,
  type HorarioSemanal,
  type PopupConfig,
  type PortadaConfig,
  type ResultadoValidacion,
  type SlideConfig,
  type TextosPortada,
  type ValoresContenido,
} from "./tipos.ts";
import {
  MAX_CHARS_DOCUMENTO,
  enlaceSeguro,
  esUrlImagenPermitida,
  sanearMarkdown,
  sanearTextoMultilinea,
  sanearTextoPlano,
} from "./markdown.ts";
import { validarVigencia } from "./fechas.ts";
import { erroresHorario } from "./horario.ts";

export const MAX_SLIDES = 12;
export const MAX_AVISOS = 20;
export const MAX_DESTACADOS = 40;
export const MARCADORES_VALIDOS = [
  "razon_social", "rut", "direccion", "direccion_corta", "telefono", "whatsapp", "email", "horario", "lugares_despacho", "tarifas",
] as const;

type Registro = Record<string, unknown>;

class Recolector {
  errores: string[] = [];
  error(msg: string) {
    this.errores.push(msg);
  }
  objeto(x: unknown, campo: string): Registro {
    if (x && typeof x === "object" && !Array.isArray(x)) return x as Registro;
    this.error(`${campo}: debe ser un objeto.`);
    return {};
  }
  texto(x: unknown, campo: string, o: { max?: number; min?: number; vacioOk?: boolean } = {}): string {
    if (typeof x !== "string") {
      this.error(`${campo}: debe ser texto.`);
      return "";
    }
    const t = sanearTextoPlano(x, (o.max ?? 300) * 4);
    if (t.length > (o.max ?? 300)) this.error(`${campo}: máximo ${o.max ?? 300} caracteres.`);
    if (!o.vacioOk && t.length < (o.min ?? 1)) this.error(`${campo}: no puede quedar vacío.`);
    return t.slice(0, o.max ?? 300);
  }
  multilinea(x: unknown, campo: string, max: number, vacioOk = false): string {
    if (typeof x !== "string") {
      this.error(`${campo}: debe ser texto.`);
      return "";
    }
    const t = sanearTextoMultilinea(x, max * 2);
    if (t.length > max) this.error(`${campo}: máximo ${max} caracteres.`);
    if (!vacioOk && !t) this.error(`${campo}: no puede quedar vacío.`);
    return t.slice(0, max);
  }
  booleano(x: unknown, campo: string): boolean {
    if (typeof x === "boolean") return x;
    this.error(`${campo}: debe ser verdadero o falso.`);
    return false;
  }
  fecha(x: unknown, campo: string): string | null {
    if (x === null || x === undefined || x === "") return null;
    if (typeof x !== "string") {
      this.error(`${campo}: debe ser una fecha en texto o null.`);
      return null;
    }
    return x.trim();
  }
  enlace(x: unknown, campo: string): string {
    const e = enlaceSeguro(x);
    if (!e) this.error(`${campo}: solo se aceptan enlaces https:// o rutas internas (/ruta).`);
    return e ?? "";
  }
  imagen(x: unknown, campo: string, vacioOk = false): string {
    if (typeof x === "string" && x.trim() === "" && vacioOk) return "";
    if (!esUrlImagenPermitida(x)) {
      this.error(`${campo}: la imagen debe ser de nuestro dominio o de nuestro bucket (subirla con la herramienta de imágenes), en jpg, png, webp, gif o avif.`);
      return "";
    }
    return (enlaceSeguro(x) as string) ?? "";
  }
  boton(x: unknown, campo: string): BotonContenido {
    const o = this.objeto(x, campo);
    return { texto: this.texto(o.texto, `${campo}.texto`, { max: 40 }), enlace: this.enlace(o.enlace, `${campo}.enlace`) };
  }
  botonOpcional(x: unknown, campo: string): BotonContenido | null {
    return x === null || x === undefined ? null : this.boton(x, campo);
  }
  sinDesconocidos(o: Registro, permitidos: string[], campo: string) {
    for (const k of Object.keys(o)) if (!permitidos.includes(k)) this.error(`${campo}: el campo "${k}" no existe.`);
  }
}

function resultado<T>(r: Recolector, valor: T): ResultadoValidacion<T> {
  return r.errores.length ? { ok: false, errores: r.errores } : { ok: true, valor };
}

// ───────── Documentos markdown ─────────

function validarMarcadores(texto: string, r: Recolector) {
  for (const m of texto.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
    if (!(MARCADORES_VALIDOS as readonly string[]).includes(m[1])) r.error(`texto: el marcador {{${m[1]}}} no existe. Válidos: ${MARCADORES_VALIDOS.join(", ")}.`);
  }
}

function documento(entrada: unknown, minimo: number): ResultadoValidacion<DocumentoMd> {
  const r = new Recolector();
  const o = r.objeto(entrada, "documento");
  r.sinDesconocidos(o, ["texto"], "documento");
  if (typeof o.texto !== "string") {
    r.error("texto: debe ser texto en markdown.");
    return resultado(r, { texto: "" });
  }
  const s = sanearMarkdown(o.texto);
  if (s.truncado) r.error(`texto: demasiado largo (máximo ${MAX_CHARS_DOCUMENTO} caracteres).`);
  if (s.texto.length < minimo) r.error(`texto: es demasiado corto (mínimo ${minimo} caracteres): parece vacío o incompleto.`);
  validarMarcadores(s.texto, r);
  return resultado(r, { texto: s.texto });
}

// ───────── Datos del local ─────────

const DIGITOS = (s: string) => s.replace(/\D/g, "");

function horarioSemanal(x: unknown, r: Recolector): HorarioSemanal {
  const o = r.objeto(x, "horario");
  const h = {} as HorarioSemanal;
  for (const dia of DIAS_SEMANA) {
    const tramos = Array.isArray(o[dia]) ? (o[dia] as unknown[]) : null;
    if (!tramos) {
      r.error(`horario.${dia}: debe ser una lista de tramos (vacía si cierra).`);
      h[dia] = [];
      continue;
    }
    h[dia] = tramos.map((t) => {
      const to = t && typeof t === "object" ? (t as Registro) : {};
      return { abre: typeof to.abre === "string" ? to.abre.trim() : "", cierra: typeof to.cierra === "string" ? to.cierra.trim() : "" };
    });
  }
  for (const e of erroresHorario(h)) r.error(e);
  return h;
}

function datosLocal(entrada: unknown): ResultadoValidacion<DatosLocal> {
  const r = new Recolector();
  const o = r.objeto(entrada, "datos_local");
  r.sinDesconocidos(o, ["nombre", "razonSocial", "rut", "direccion", "calle", "comuna", "region", "codigoPostal", "telefono", "telefonoDisplay", "whatsapp", "email", "instagram", "geo", "horario"], "datos_local");
  const telefono = r.texto(o.telefono, "telefono", { max: 16 });
  if (telefono && !/^\+\d{8,15}$/.test(telefono)) r.error('telefono: formato internacional con "+", por ejemplo +56976673577.');
  const whatsapp = DIGITOS(r.texto(o.whatsapp, "whatsapp", { max: 16 }));
  if (!/^\d{8,15}$/.test(whatsapp)) r.error("whatsapp: solo dígitos con código de país, por ejemplo 56976673577.");
  const email = r.texto(o.email, "email", { max: 120 });
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) r.error("email: no parece un correo válido.");
  const instagram = r.texto(o.instagram, "instagram", { max: 200, vacioOk: true });
  if (instagram && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._/-]+$/.test(instagram)) r.error("instagram: debe ser https://www.instagram.com/usuario/.");
  const g = r.objeto(o.geo, "geo");
  const lat = Number(g.lat);
  const lng = Number(g.lng);
  if (!(Number.isFinite(lat) && lat >= -90 && lat <= 90)) r.error("geo.lat: debe estar entre -90 y 90.");
  if (!(Number.isFinite(lng) && lng >= -180 && lng <= 180)) r.error("geo.lng: debe estar entre -180 y 180.");
  const valor: DatosLocal = {
    nombre: r.texto(o.nombre, "nombre", { max: 80 }),
    razonSocial: r.texto(o.razonSocial, "razonSocial", { max: 120 }),
    rut: r.texto(o.rut, "rut", { max: 14 }),
    direccion: r.texto(o.direccion, "direccion", { max: 160 }),
    calle: r.texto(o.calle, "calle", { max: 100 }),
    comuna: r.texto(o.comuna, "comuna", { max: 60 }),
    region: r.texto(o.region, "region", { max: 60 }),
    codigoPostal: r.texto(o.codigoPostal, "codigoPostal", { max: 10, vacioOk: true }),
    telefono,
    telefonoDisplay: r.texto(o.telefonoDisplay, "telefonoDisplay", { max: 24 }),
    whatsapp,
    email,
    instagram,
    geo: { lat, lng },
    horario: horarioSemanal(o.horario, r),
  };
  if (valor.rut && !/^\d{1,2}\.\d{3}\.\d{3}-[\dKk]$/.test(valor.rut)) r.error("rut: formato 77.722.788-2.");
  return resultado(r, valor);
}

// ───────── Popup, slides, cinta, avisos ─────────

function popup(entrada: unknown): ResultadoValidacion<PopupConfig> {
  const r = new Recolector();
  const o = r.objeto(entrada, "popup");
  r.sinDesconocidos(o, ["activo", "imagen", "titular", "texto", "botonPrincipal", "botonSecundario", "nota", "notaEnlace", "desde", "hasta", "cadaDias"], "popup");
  const dias = Number(o.cadaDias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) r.error("cadaDias: un número entero entre 1 y 90.");
  const v: PopupConfig = {
    activo: r.booleano(o.activo, "activo"),
    imagen: r.imagen(o.imagen, "imagen", true),
    titular: r.texto(o.titular, "titular", { max: 90 }),
    texto: r.multilinea(o.texto, "texto", 400),
    botonPrincipal: r.boton(o.botonPrincipal, "botonPrincipal"),
    botonSecundario: r.texto(o.botonSecundario, "botonSecundario", { max: 30 }),
    nota: r.texto(o.nota, "nota", { max: 160, vacioOk: true }),
    notaEnlace: r.botonOpcional(o.notaEnlace, "notaEnlace"),
    desde: r.fecha(o.desde, "desde"),
    hasta: r.fecha(o.hasta, "hasta"),
    cadaDias: Number.isInteger(dias) ? dias : 7,
  };
  for (const e of validarVigencia(v, "popup")) r.error(e);
  return resultado(r, v);
}

function idCorto(x: unknown, campo: string, r: Recolector): string {
  if (typeof x !== "string" || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(x)) {
    r.error(`${campo}: un id corto en minúsculas, números, guion o guion bajo (máx. 40).`);
    return "";
  }
  return x;
}

function sinRepetidos(ids: string[], campo: string, r: Recolector) {
  const vistos = new Set<string>();
  for (const id of ids) {
    if (id && vistos.has(id)) r.error(`${campo}: el id "${id}" está repetido.`);
    vistos.add(id);
  }
}

function slides(entrada: unknown): ResultadoValidacion<SlideConfig[]> {
  const r = new Recolector();
  if (!Array.isArray(entrada)) {
    r.error("slides: debe ser una lista.");
    return resultado(r, []);
  }
  if (entrada.length > MAX_SLIDES) r.error(`slides: máximo ${MAX_SLIDES} láminas.`);
  const lista = entrada.slice(0, MAX_SLIDES).map((x, i): SlideConfig => {
    const c = `slides[${i}]`;
    const o = r.objeto(x, c);
    r.sinDesconocidos(o, ["id", "activa", "imagenDesktop", "imagenMovil", "alt", "eyebrow", "titulo", "subtitulo", "boton", "desde", "hasta", "precio"], c);
    let precio: SlideConfig["precio"] = null;
    if (o.precio !== null && o.precio !== undefined) {
      const p = r.objeto(o.precio, `${c}.precio`);
      const familia = p.familia;
      if (familia !== "fierro" && familia !== "tubo" && familia !== "zinc") r.error(`${c}.precio.familia: fierro, tubo o zinc.`);
      precio = { familia: (familia as "fierro" | "tubo" | "zinc") ?? "tubo", nota: r.texto(p.nota, `${c}.precio.nota`, { max: 40 }) };
    }
    const s: SlideConfig = {
      id: idCorto(o.id, `${c}.id`, r),
      activa: r.booleano(o.activa, `${c}.activa`),
      imagenDesktop: r.imagen(o.imagenDesktop, `${c}.imagenDesktop`),
      imagenMovil: o.imagenMovil === null || o.imagenMovil === undefined || o.imagenMovil === "" ? null : r.imagen(o.imagenMovil, `${c}.imagenMovil`),
      alt: r.texto(o.alt, `${c}.alt`, { max: 160 }),
      eyebrow: r.texto(o.eyebrow, `${c}.eyebrow`, { max: 70, vacioOk: true }),
      titulo: r.texto(o.titulo, `${c}.titulo`, { max: 80 }),
      subtitulo: r.texto(o.subtitulo, `${c}.subtitulo`, { max: 200, vacioOk: true }),
      boton: r.botonOpcional(o.boton, `${c}.boton`),
      desde: r.fecha(o.desde, `${c}.desde`),
      hasta: r.fecha(o.hasta, `${c}.hasta`),
      precio,
    };
    for (const e of validarVigencia(s, c)) r.error(e);
    return s;
  });
  sinRepetidos(lista.map((s) => s.id), "slides", r);
  return resultado(r, lista);
}

function cinta(entrada: unknown): ResultadoValidacion<CintaConfig> {
  const r = new Recolector();
  const o = r.objeto(entrada, "cinta");
  r.sinDesconocidos(o, ["activa", "texto", "enlace", "desde", "hasta"], "cinta");
  const activa = r.booleano(o.activa, "activa");
  const v: CintaConfig = {
    activa,
    texto: r.texto(o.texto, "texto", { max: 140, vacioOk: !activa }),
    enlace: r.botonOpcional(o.enlace, "enlace"),
    desde: r.fecha(o.desde, "desde"),
    hasta: r.fecha(o.hasta, "hasta"),
  };
  for (const e of validarVigencia(v, "cinta")) r.error(e);
  return resultado(r, v);
}

function avisos(entrada: unknown): ResultadoValidacion<AvisoConfig[]> {
  const r = new Recolector();
  if (!Array.isArray(entrada)) {
    r.error("avisos: debe ser una lista.");
    return resultado(r, []);
  }
  if (entrada.length > MAX_AVISOS) r.error(`avisos: máximo ${MAX_AVISOS}.`);
  const lista = entrada.slice(0, MAX_AVISOS).map((x, i): AvisoConfig => {
    const c = `avisos[${i}]`;
    const o = r.objeto(x, c);
    r.sinDesconocidos(o, ["id", "activo", "tipo", "severidad", "titulo", "texto", "desde", "hasta", "donde"], c);
    if (!(TIPOS_AVISO as readonly string[]).includes(o.tipo as string)) r.error(`${c}.tipo: ${TIPOS_AVISO.join(", ")}.`);
    if (!(SEVERIDADES_AVISO as readonly string[]).includes(o.severidad as string)) r.error(`${c}.severidad: ${SEVERIDADES_AVISO.join(", ")}.`);
    const dondeEntrada = Array.isArray(o.donde) ? o.donde : null;
    if (!dondeEntrada || dondeEntrada.length === 0) r.error(`${c}.donde: lista con ${LUGARES_AVISO.join(", ")}.`);
    const donde = [...new Set((dondeEntrada ?? []).filter((d): d is (typeof LUGARES_AVISO)[number] => (LUGARES_AVISO as readonly string[]).includes(d as string)))];
    if (dondeEntrada && donde.length !== new Set(dondeEntrada).size) r.error(`${c}.donde: solo ${LUGARES_AVISO.join(", ")}.`);
    const a: AvisoConfig = {
      id: idCorto(o.id, `${c}.id`, r),
      activo: r.booleano(o.activo, `${c}.activo`),
      tipo: (o.tipo as AvisoConfig["tipo"]) ?? "otro",
      severidad: (o.severidad as AvisoConfig["severidad"]) ?? "info",
      titulo: r.texto(o.titulo, `${c}.titulo`, { max: 90 }),
      texto: r.multilinea(o.texto, `${c}.texto`, 400, true),
      desde: r.fecha(o.desde, `${c}.desde`),
      hasta: r.fecha(o.hasta, `${c}.hasta`),
      donde,
    };
    for (const e of validarVigencia(a, c)) r.error(e);
    return a;
  });
  sinRepetidos(lista.map((a) => a.id), "avisos", r);
  return resultado(r, lista);
}

// ───────── Portada y textos ─────────

function portada(entrada: unknown): ResultadoValidacion<PortadaConfig> {
  const r = new Recolector();
  const o = r.objeto(entrada, "portada");
  r.sinDesconocidos(o, ["secciones", "productosDestacados", "categoriasDestacadas"], "portada");
  const seccionesIn = Array.isArray(o.secciones) ? o.secciones : null;
  if (!seccionesIn) r.error("secciones: debe ser una lista.");
  const secciones = (seccionesIn ?? []).map((x, i) => {
    const so = r.objeto(x, `secciones[${i}]`);
    if (!(SECCIONES_PORTADA as readonly string[]).includes(so.id as string)) r.error(`secciones[${i}].id: ${SECCIONES_PORTADA.join(", ")}.`);
    return { id: so.id as PortadaConfig["secciones"][number]["id"], visible: r.booleano(so.visible, `secciones[${i}].visible`) };
  });
  const ids = secciones.map((s) => s.id);
  if (new Set(ids).size !== ids.length) r.error("secciones: hay una sección repetida.");
  for (const id of SECCIONES_PORTADA) if (!ids.includes(id)) r.error(`secciones: falta "${id}" (si no la quieres, márcala visible: false).`);
  const lista = (x: unknown, campo: string, patron: RegExp, ayuda: string): string[] => {
    if (!Array.isArray(x)) {
      r.error(`${campo}: debe ser una lista.`);
      return [];
    }
    if (x.length > MAX_DESTACADOS) r.error(`${campo}: máximo ${MAX_DESTACADOS}.`);
    const out: string[] = [];
    for (const v of x.slice(0, MAX_DESTACADOS)) {
      if (typeof v !== "string" || !patron.test(v.trim())) r.error(`${campo}: "${String(v).slice(0, 30)}" no es válido (${ayuda}).`);
      else if (!out.includes(v.trim())) out.push(v.trim());
    }
    return out;
  };
  return resultado(r, {
    secciones,
    productosDestacados: lista(o.productosDestacados, "productosDestacados", /^[A-Za-z0-9._\-/ ]{1,40}$/, "código de producto"),
    categoriasDestacadas: lista(o.categoriasDestacadas, "categoriasDestacadas", /^[a-z0-9][a-z0-9-]{0,80}$/, "slug de categoría en minúsculas"),
  });
}

function textos(entrada: unknown): ResultadoValidacion<TextosPortada> {
  const r = new Recolector();
  const o = r.objeto(entrada, "textos");
  r.sinDesconocidos(o, ["h1", "tituloCategorias", "tituloMasVendidos", "tituloFierroPerfiles", "tituloMarcas", "pieDescripcion"], "textos");
  return resultado(r, {
    h1: r.texto(o.h1, "h1", { max: 160 }),
    tituloCategorias: r.texto(o.tituloCategorias, "tituloCategorias", { max: 60 }),
    tituloMasVendidos: r.texto(o.tituloMasVendidos, "tituloMasVendidos", { max: 60 }),
    tituloFierroPerfiles: r.texto(o.tituloFierroPerfiles, "tituloFierroPerfiles", { max: 60 }),
    tituloMarcas: r.texto(o.tituloMarcas, "tituloMarcas", { max: 60 }),
    pieDescripcion: r.multilinea(o.pieDescripcion, "pieDescripcion", 260),
  });
}

function contacto(entrada: unknown): ResultadoValidacion<ContactoTextos> {
  const r = new Recolector();
  const o = r.objeto(entrada, "contacto");
  r.sinDesconocidos(o, ["intro", "nota"], "contacto");
  return resultado(r, { intro: r.multilinea(o.intro, "intro", 300), nota: r.multilinea(o.nota, "nota", 300) });
}

/** Valida y limpia el valor de una clave. Nunca lanza. */
export function validarContenido<K extends ClaveContenido>(clave: K, entrada: unknown): ResultadoValidacion<ValoresContenido[K]> {
  let res: ResultadoValidacion<unknown>;
  switch (clave) {
    case "terminos": res = documento(entrada, 500); break;
    case "privacidad": res = documento(entrada, 500); break;
    case "envios": res = documento(entrada, 100); break;
    case "nosotros": res = documento(entrada, 100); break;
    case "contacto": res = contacto(entrada); break;
    case "datos_local": res = datosLocal(entrada); break;
    case "popup": res = popup(entrada); break;
    case "slides": res = slides(entrada); break;
    case "cinta": res = cinta(entrada); break;
    case "avisos": res = avisos(entrada); break;
    case "portada": res = portada(entrada); break;
    case "textos": res = textos(entrada); break;
    default: res = { ok: false, errores: ["Tipo de contenido desconocido."] };
  }
  return res as ResultadoValidacion<ValoresContenido[K]>;
}
