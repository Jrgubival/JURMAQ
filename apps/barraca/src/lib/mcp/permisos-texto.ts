/**
 * Lo que se le muestra a Jorge en la pantalla de autorización, en palabras
 * simples. Las piezas que agregan herramientas actualizan estas listas para
 * que lo prometido coincida con lo que Claude realmente puede hacer.
 *
 * Hay DOS niveles de permiso (scopes):
 *  - básico (`tienda:leer` + `tienda:escribir`): catálogo, precios, textos, correos y campañas en borrador, etc.
 *    Sin el permiso de dinero NO puede tocar pagos ni borrar nada.
 *  - dinero y borrado (`tienda:dinero`): permiso APARTE, desmarcado por defecto en la pantalla de autorización.
 *    La lista de abajo (DINERO_PUEDE) debe coincidir EXACTAMENTE con las herramientas que declaran `scope: "tienda:dinero"`.
 */
import { SCOPE_DINERO } from "./config.ts";
import { TOPES_DINERO } from "./topes-dinero.ts";

export const PUEDE: readonly string[] = [
  "Ver los productos, precios, categorías y ventas de la tienda.",
  "Cambiar precios, ofertas y textos de la tienda cuando tú se lo pidas.",
  "Prepararte cambios grandes y mostrártelos antes de aplicarlos.",
  "Redactar borradores de los correos que reciben los clientes (solo los textos) y de campañas a suscriptores.",
  "Editar el título y la descripción que ve Google (productos, categorías y páginas), las guías de construcción y los productos relacionados de cada ficha.",
];

/** Lo que Claude NO puede hacer en NINGÚN nivel (incluso con el permiso de dinero). */
export const NO_PUEDE_SIEMPRE: readonly string[] = [
  "Ver ni cambiar contraseñas, claves ni usuarios del panel.",
  "Enviar ni programar correos ni campañas: las campañas quedan como borrador y las envías tú.",
  "Cambiar el modo de aprobación: eso lo defines tú en la configuración del sitio, no Claude.",
];

/** Sin el permiso de dinero: pagos y borrado quedan fuera. */
export const NO_PUEDE_SIN_DINERO: readonly string[] = [
  "Tocar pagos: no puede confirmar transferencias, cobrar, devolver ni mover dinero.",
  "Borrar ni archivar pedidos, clientes ni suscriptores.",
];

/**
 * Con el permiso de dinero, esto es TODO lo que además podrá. Una línea por grupo de herramientas; la clave es el
 * nombre de CADA herramienta con `scope: "tienda:dinero"`. Una prueba exige que las claves sean EXACTAMENTE las
 * herramientas de dinero del registro: no puede existir una herramienta de dinero que este texto no mencione.
 */
export const DINERO_TEXTO_POR_HERRAMIENTA: Readonly<Record<string, string>> = {
  previsualizar_confirmar_transferencia: "Confirmar una transferencia que ya recibiste en tu cuenta (el pedido pasa a pagado y el cliente recibe el correo de pago recibido).",
  confirmar_transferencia_recibida: "Confirmar una transferencia que ya recibiste en tu cuenta (el pedido pasa a pagado y el cliente recibe el correo de pago recibido).",
  previsualizar_cancelar_pedido_pagado: "Cancelar un pedido ya pagado con su devolución: por Webpay se devuelve sola a la misma tarjeta; por transferencia queda pendiente y tú anotas la cuenta en el panel.",
  confirmar_cancelar_pedido_pagado: "Cancelar un pedido ya pagado con su devolución: por Webpay se devuelve sola a la misma tarjeta; por transferencia queda pendiente y tú anotas la cuenta en el panel.",
  devolucion_transferencia_hecha: "Marcar como hecha una devolución por transferencia, solo después de que tú la hagas en tu banco.",
  archivar_pedido: "Archivar pedidos (salen de las listas y los reportes, y se pueden volver a mostrar).",
  desarchivar_pedido: "Archivar pedidos (salen de las listas y los reportes, y se pueden volver a mostrar).",
  borrar_pedido_definitivo: "Borrar para siempre un pedido que nunca se pagó (cancelado o vencido, sin boleta ni devolución).",
  borrar_datos_persona: "Borrar los datos de un cliente o suscriptor, de uno en uno (los pedidos pagados se conservan).",
};

export const DINERO_PUEDE: readonly string[] = [...new Set(Object.values(DINERO_TEXTO_POR_HERRAMIENTA))];

/** Aviso fijo del permiso de dinero y borrado. */
export const DINERO_NOTA_AVISO = "Cada operación de dinero o borrado le llega a Jorge por correo (sin datos personales del cliente) y no se puede deshacer desde Claude.";

/** Con el permiso de dinero, esto SIGUE fuera. */
export const DINERO_SIGUE_FUERA: readonly string[] = [
  "Ver ni cambiar las cuentas bancarias, los enlaces de pago ni los datos de la cuenta de la barraca.",
  "Cambiar claves, usuarios ni roles.",
  "Borrar pedidos que ya fueron pagados (esos solo se cancelan con devolución o se archivan).",
  "Enviar correos masivos.",
];

/** Lo que se promete al elegir cada nivel, además de lo anterior. */
export const NO_PUEDE_CON_DINERO: readonly string[] = [...NO_PUEDE_SIEMPRE, ...DINERO_SIGUE_FUERA];

/** Compatibilidad: la lista «no podrá» del nivel básico. */
export const NO_PUEDE: readonly string[] = [
  ...NO_PUEDE_SIN_DINERO,
  ...NO_PUEDE_SIEMPRE,
  "Hacer cambios grandes o riesgosos sin tu aprobación por correo (más de 300 productos, un precio que se mueva más de 30 %, precios bajo el costo, descuentos, despacho, términos legales, textos de correos a clientes, o un texto que agregue un teléfono, un correo o un enlace a otro sitio).",
];

/** Tope duro, en ambos modos de aprobación: ni con el OK de Jorge. */
export const TOPES_DUROS: readonly string[] = [
  "Dejar un producto a precio 0 o negativo.",
  "Vender bajo el 50 % del costo (cuando el costo está cargado).",
  "Tocar datos bancarios ni enlaces de pago (tampoco en nombres y descripciones de productos).",
  `Pasar de ${TOPES_DINERO.operacionesPorHora} operaciones de dinero o borrado por hora (${TOPES_DINERO.operacionesPor24h} al día), de ${TOPES_DINERO.devolucionesPorHora} devoluciones por hora, ni de $${TOPES_DINERO.montoDevueltoPor24h.toLocaleString("es-CL")} devueltos en 24 horas.`,
];

export const NOTAS: readonly string[] = [
  "Cada cambio queda anotado y lo puedes deshacer desde Administración, Conexiones.",
  "Puedes cortar el acceso de Claude cuando quieras, en la misma pantalla.",
];

export interface TextoPermisos {
  /** ¿Incluye el permiso de dinero y borrado? */
  dinero: boolean;
  puede: string[];
  noPuede: string[];
  notas: string[];
}

/** Lo que puede y no puede una conexión con ESTE scope (conexiones activas, guía, pruebas). */
export function textoPermisos(scope: string): TextoPermisos {
  const dinero = scope.split(" ").includes(SCOPE_DINERO);
  const base = [...PUEDE];
  const requiereOk = NO_PUEDE[NO_PUEDE.length - 1];
  return dinero
    ? { dinero, puede: [...base, ...DINERO_PUEDE], noPuede: [...NO_PUEDE_CON_DINERO, requiereOk], notas: [...NOTAS, DINERO_NOTA_AVISO] }
    : { dinero, puede: base, noPuede: [...NO_PUEDE], notas: [...NOTAS] };
}

/** Texto corto del permiso de una conexión (panel /admin/conexiones). */
export function etiquetaPermiso(scope: string): string {
  const s = scope.split(" ");
  if (s.includes(SCOPE_DINERO)) return "ver, cambiar, y también dinero y borrado";
  if (s.includes("tienda:escribir")) return "ver y cambiar (sin dinero ni borrado)";
  return "solo ver";
}
