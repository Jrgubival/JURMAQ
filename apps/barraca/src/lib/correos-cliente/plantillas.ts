/**
 * Correos al cliente: qué textos se pueden editar y con qué variables. Puro (sin Next ni Supabase).
 *
 * Solo se editan TEXTOS (asunto, título, resumen de la bandeja, saludo, párrafos y despedida). El diseño
 * HTML, los productos, el total, la forma de pago, los datos de la cuenta para transferir, los enlaces
 * (Ver tu pedido, opinión, baja) y los Términos son bloques FIJOS que arma el código (lib/pedidos/correos.ts):
 * ninguna plantilla puede tocarlos ni moverlos.
 *
 * Los `defecto` de cada campo son EXACTAMENTE el texto que estaba escrito en el código antes de esta
 * pieza (scripts/correos-cliente.test.mjs lo comprueba byte a byte contra el correo real).
 */

export type ClaveCorreo =
  | "confirmacion_pedido"
  | "confirmacion_transferencia"
  | "pago_recibido"
  | "rechazo_pedido"
  | "cancelacion_pedido"
  | "devolucion_hecha"
  | "pedir_opinion"
  | "documento_tributario";

export const CLAVES_CORREO: readonly ClaveCorreo[] = [
  "confirmacion_pedido", "confirmacion_transferencia", "pago_recibido", "rechazo_pedido",
  "cancelacion_pedido", "devolucion_hecha", "pedir_opinion", "documento_tributario",
];

export const esClaveCorreo = (x: unknown): x is ClaveCorreo => typeof x === "string" && (CLAVES_CORREO as readonly string[]).includes(x);

/** asunto/titulo/preheader salen como texto plano; parrafo/despedida como HTML (todo escapado). */
export type TipoCampo = "asunto" | "titulo" | "preheader" | "parrafo" | "despedida";

export const esCampoHtml = (t: TipoCampo) => t === "parrafo" || t === "despedida";

export interface DefVariable {
  descripcion: string;
  /** Valor de ejemplo para la vista previa. */
  ejemplo: string;
  /** Solo en párrafos (no en asunto, título ni resumen de la bandeja): datos que no deben verse en un asunto. */
  soloCuerpo?: boolean;
}

/** Todas las variables que existen. Cada plantilla acepta solo un subconjunto. */
export const VARIABLES: Record<string, DefVariable> = {
  nombre: { descripcion: "Primer nombre del cliente", ejemplo: "Juana" },
  numero_pedido: { descripcion: "Número del pedido", ejemplo: "BJ-261120-AB12" },
  total: { descripcion: "Total del pedido, con $ y puntos", ejemplo: "$15.000" },
  email_tienda: { descripcion: "Correo de contacto de la barraca", ejemplo: "contacto@jurmaq.cl" },
  whatsapp_tienda: { descripcion: "WhatsApp de la barraca para leer", ejemplo: "+56 9 7667 3577" },
  direccion_tienda: { descripcion: "Dirección corta de la barraca", ejemplo: "Av. Poniente 2157, Molina" },
  horario_semana: { descripcion: "Horario de lunes a viernes", ejemplo: "Lunes a viernes 8:30–13:00 y 14:30–18:00" },
  horario_sabado: { descripcion: "Horario del sábado", ejemplo: "Sábado 9:00–13:00" },
  monto_devolucion: { descripcion: "Monto devuelto, con $ y puntos", ejemplo: "$15.000" },
  cuenta_devolucion: { descripcion: "Banco y últimos 4 dígitos de la cuenta donde se devolvió", ejemplo: "BancoEstado, cuenta terminada en 1234", soloCuerpo: true },
  documento: { descripcion: "«boleta» o «factura»", ejemplo: "boleta" },
  documento_cap: { descripcion: "«Boleta» o «Factura» (con mayúscula)", ejemplo: "Boleta" },
};

export type VariablesCorreo = Partial<Record<string, string>>;

const COMUNES = ["nombre", "numero_pedido", "total", "email_tienda", "whatsapp_tienda", "direccion_tienda", "horario_semana", "horario_sabado"] as const;

export interface DefCampo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Largo máximo del texto (con las variables sin reemplazar). */
  max: number;
  /** El texto actual del código. */
  defecto: string;
  /** Puede quedar vacío (la despedida es opcional y por defecto no sale). */
  opcional?: boolean;
  /** Variables que el texto debe incluir sí o sí (el cliente tiene que ver su número de pedido en el asunto). */
  obligatorias?: string[];
  /** Cuándo se usa (para campos que dependen del motivo). */
  cuando?: string;
}

export type PasoEstructura = { campo: string } | { fijo: string };

export interface DefPlantilla {
  clave: ClaveCorreo;
  titulo: string;
  /** Cuándo lo recibe el cliente. */
  cuando: string;
  variables: readonly string[];
  campos: DefCampo[];
  /** Orden del correo: campos editables y bloques fijos (para la vista previa). */
  estructura: PasoEstructura[];
}

const ASUNTO_MAX = 150;
const TITULO_MAX = 120;
const PREHEADER_MAX = 150;
const PARRAFO_MAX = 600;
const DESPEDIDA_MAX = 400;

const campoAsunto = (defecto: string): DefCampo => ({ clave: "asunto", etiqueta: "Asunto del correo", tipo: "asunto", max: ASUNTO_MAX, defecto, obligatorias: ["numero_pedido"] });
const campoTitulo = (defecto: string, obligatorias?: string[]): DefCampo => ({ clave: "titulo", etiqueta: "Título dentro del correo", tipo: "titulo", max: TITULO_MAX, defecto, ...(obligatorias ? { obligatorias } : {}) });
const campoPreheader = (defecto: string, clave = "preheader", etiqueta = "Resumen que se ve en la bandeja de entrada", cuando?: string): DefCampo => ({ clave, etiqueta, tipo: "preheader", max: PREHEADER_MAX, defecto, ...(cuando ? { cuando } : {}) });
const campoParrafo = (clave: string, etiqueta: string, defecto: string, cuando?: string): DefCampo => ({ clave, etiqueta, tipo: "parrafo", max: PARRAFO_MAX, defecto, ...(cuando ? { cuando } : {}) });
const campoDespedida = (): DefCampo => ({ clave: "despedida", etiqueta: "Despedida (opcional, por defecto no hay)", tipo: "despedida", max: DESPEDIDA_MAX, defecto: "", opcional: true });

const SALUDO_PEDIDO = "Hola {nombre}, este es el detalle de tu pedido **{numero_pedido}**.";
const DUDAS = "Si tienes dudas, escríbenos a {email_tienda} o al {whatsapp_tienda}.";

const FIJO_CONFIRMACION: PasoEstructura[] = [
  { fijo: "Detalle de los productos, descuentos, despacho y total del pedido" },
  { fijo: "Cómo se entrega (retiro con dirección y horario, o despacho)" },
  { fijo: "Documento pedido (boleta o factura)" },
  { fijo: "Forma de pago: datos de la cuenta para transferir (si paga por transferencia) o comprobante del pago" },
  { fijo: "Botón «Ver tu pedido» con el enlace personal del cliente" },
];
const FIJO_TERMINOS = { fijo: "Aviso de Términos y Condiciones con su enlace" };

function plantillaConfirmacion(clave: ClaveCorreo, titulo: string, cuando: string, tituloCorreo: string, preheader: string): DefPlantilla {
  return {
    clave, titulo, cuando, variables: COMUNES,
    campos: [
      campoAsunto(`${tituloCorreo} | Barraca JURMAQ`),
      campoTitulo(tituloCorreo),
      campoPreheader(preheader),
      campoParrafo("saludo", "Saludo", SALUDO_PEDIDO),
      campoDespedida(),
    ],
    estructura: [{ campo: "saludo" }, ...FIJO_CONFIRMACION, { campo: "despedida" }, FIJO_TERMINOS],
  };
}

export const PLANTILLAS: Record<ClaveCorreo, DefPlantilla> = {
  confirmacion_pedido: plantillaConfirmacion(
    "confirmacion_pedido", "Confirmación de pedido (pago en línea pendiente)",
    "Cuando el cliente hace un pedido y todavía no paga (Webpay). Es el mismo correo que sale en cualquier estado que no sea pagado ni transferencia.",
    "Recibimos tu pedido {numero_pedido}", "Pedido {numero_pedido} por {total}",
  ),
  confirmacion_transferencia: plantillaConfirmacion(
    "confirmacion_transferencia", "Confirmación de pedido por transferencia",
    "Cuando el cliente hace un pedido pagando por transferencia. Trae abajo, fijos, los datos de la cuenta y el monto exacto.",
    "Recibimos tu pedido {numero_pedido}", "Pedido {numero_pedido} por {total}",
  ),
  pago_recibido: plantillaConfirmacion(
    "pago_recibido", "Pago recibido",
    "Cuando el pago queda confirmado (Webpay aprobado o transferencia confirmada por la barraca).",
    "Pago recibido · pedido {numero_pedido}", "Pedido {numero_pedido} por {total}",
  ),
  rechazo_pedido: {
    clave: "rechazo_pedido", titulo: "Pedido no aprobado (devolución)",
    cuando: "Cuando la barraca no puede aprobar un pedido (sin stock, error de precio, sin despacho…). El motivo y lo que pasa con la plata son fijos.",
    variables: COMUNES,
    campos: [
      campoAsunto("No pudimos aprobar tu pedido {numero_pedido} | Barraca JURMAQ"),
      campoTitulo("No pudimos aprobar tu pedido {numero_pedido}"),
      campoPreheader("Te devolvemos el 100% de lo pagado"),
      campoParrafo("saludo", "Saludo", "Hola {nombre}, lamentamos avisarte que no podemos aprobar tu pedido **{numero_pedido}**."),
      campoParrafo("dudas", "Párrafo de dudas", DUDAS),
      campoDespedida(),
    ],
    estructura: [
      { campo: "saludo" },
      { fijo: "Motivo del rechazo (de una lista cerrada)" },
      { fijo: "Si no pudimos despachar: opción de retirar en la barraca" },
      { fijo: "Qué pasa con el dinero: devolución del 100%, por Webpay o por transferencia (con lo que debe enviar el cliente)" },
      { fijo: "Botón «Ver tu pedido»" },
      { campo: "dudas" },
      { campo: "despedida" },
      { fijo: "Referencia a los Términos, sección 8.4" },
    ],
  },
  cancelacion_pedido: {
    clave: "cancelacion_pedido", titulo: "Pedido anulado",
    cuando: "Cuando se anula un pedido (a pedido del cliente, transferencia no recibida, vencido a las 48 horas u otro motivo). Lo que pasa con el dinero es fijo.",
    variables: COMUNES,
    campos: [
      campoAsunto("Anulamos tu pedido {numero_pedido} | Barraca JURMAQ"),
      campoTitulo("Anulamos tu pedido {numero_pedido}"),
      campoPreheader("Te devolvemos el 100% de lo pagado", "preheader_pagado", "Resumen en la bandeja si el cliente ya había pagado", "Pedido ya pagado"),
      campoPreheader("No se cobró nada", "preheader_sin_pago", "Resumen en la bandeja si el cliente no había pagado", "Pedido sin pago"),
      campoParrafo("intro_transferencia_no_recibida", "Saludo si no llegó la transferencia", "Hola {nombre}, no recibimos el pago de tu pedido **{numero_pedido}**, por eso lo anulamos.", "Motivo: transferencia no recibida"),
      campoParrafo("intro_vencido", "Saludo si el pedido venció", "Hola {nombre}, no recibimos la transferencia de tu pedido **{numero_pedido}** dentro de 48 horas, así que lo anulamos sin costo para ti (Términos 8.3).", "Motivo: sin pago en 48 horas"),
      campoParrafo("intro_cliente", "Saludo si lo pidió el cliente", "Hola {nombre}, anulamos tu pedido **{numero_pedido}**, como nos pediste.", "Motivo: a pedido del cliente"),
      campoParrafo("intro_otro", "Saludo para cualquier otro motivo", "Hola {nombre}, anulamos tu pedido **{numero_pedido}**.", "Otro motivo o sin motivo"),
      campoParrafo("dudas", "Párrafo de dudas", DUDAS),
      campoDespedida(),
    ],
    estructura: [
      { campo: "intro_transferencia_no_recibida" }, { campo: "intro_vencido" }, { campo: "intro_cliente" }, { campo: "intro_otro" },
      { fijo: "Motivo de la anulación (de una lista cerrada)" },
      { fijo: "Productos y total del pedido" },
      { fijo: "Qué pasa con el dinero (nada que devolver, anulación en Webpay o devolución por transferencia con lo que debe enviar el cliente)" },
      { fijo: "Botón «Ver tu pedido»" },
      { campo: "dudas" },
      { campo: "despedida" },
      { fijo: "Referencia a los Términos y Condiciones" },
    ],
  },
  devolucion_hecha: {
    clave: "devolucion_hecha", titulo: "Devolución hecha",
    cuando: "Cuando la barraca marca en el panel que ya transfirió la devolución al cliente.",
    variables: [...COMUNES, "monto_devolucion", "cuenta_devolucion"],
    campos: [
      campoAsunto("Te devolvimos el pago del pedido {numero_pedido} | Barraca JURMAQ"),
      campoTitulo("Te devolvimos el pago del pedido {numero_pedido}"),
      campoPreheader("Transferimos {monto_devolucion}"),
      campoParrafo("saludo", "Saludo", "Hola {nombre}, te transferimos **{monto_devolucion}** del pedido **{numero_pedido}** a {cuenta_devolucion}."),
      campoParrafo("dudas", "Párrafo si no ve el abono", "Si no ves el abono, respóndenos este correo o escríbenos por WhatsApp al {whatsapp_tienda}."),
      campoDespedida(),
    ],
    estructura: [{ campo: "saludo" }, { campo: "dudas" }, { campo: "despedida" }, { fijo: "Referencia a los Términos, sección 12" }],
  },
  pedir_opinion: {
    clave: "pedir_opinion", titulo: "Pedir opinión de los productos",
    cuando: "Una sola vez por pedido, entre 2 y 30 días después de entregado (si el cliente no pidió la baja de correos).",
    variables: COMUNES,
    campos: [
      campoAsunto("¿Qué te parecieron tus productos? · pedido {numero_pedido} | Barraca JURMAQ"),
      campoTitulo("¿Qué te parecieron tus productos?"),
      campoPreheader("Cuéntanos cómo te fue con tu pedido {numero_pedido}"),
      campoParrafo("saludo", "Saludo", "Hola {nombre}, ya entregamos tu pedido **{numero_pedido}**."),
      campoParrafo("invitacion", "Invitación a opinar", "Si tienes un minuto, califica los productos que compraste. Tu opinión ayuda a otros clientes a elegir:"),
      campoDespedida(),
    ],
    estructura: [
      { campo: "saludo" }, { campo: "invitacion" },
      { fijo: "Lista de los productos comprados" },
      { fijo: "Botón «Dar mi opinión» con el enlace de un solo uso" },
      { fijo: "Aviso de cómo se publica el nombre en la opinión" },
      { campo: "despedida" },
      { fijo: "Aviso de que se escribe una sola vez, con el enlace para no recibir más correos" },
    ],
  },
  documento_tributario: {
    clave: "documento_tributario", titulo: "Boleta o factura adjunta",
    cuando: "Cuando la barraca sube la boleta o factura al pedido y se la manda al cliente en PDF.",
    variables: [...COMUNES, "documento", "documento_cap"],
    campos: [
      campoAsunto("Tu {documento} del pedido {numero_pedido} | Barraca JURMAQ"),
      campoTitulo("Tu {documento} del pedido {numero_pedido}"),
      campoPreheader("{documento_cap} adjunta en PDF"),
      campoParrafo("saludo", "Saludo", "Hola {nombre}, te adjuntamos la {documento} de tu pedido **{numero_pedido}** por **{total}**."),
      campoParrafo("dudas", "Párrafo si hay un dato mal", "Si algún dato está mal, respóndenos este correo o escríbenos a {email_tienda}."),
      campoDespedida(),
    ],
    estructura: [
      { campo: "saludo" },
      { fijo: "Datos de la factura (razón social y RUT), si es factura" },
      { fijo: "Botón «Ver tu pedido»" },
      { campo: "dudas" },
      { campo: "despedida" },
    ],
  },
};

/** Variables que acepta un campo: las de su plantilla; en asunto, título y resumen, sin las «solo cuerpo». */
export function variablesDeCampo(clave: ClaveCorreo, campo: DefCampo): string[] {
  const def = PLANTILLAS[clave];
  return def.variables.filter((v) => esCampoHtml(campo.tipo) || !VARIABLES[v]?.soloCuerpo);
}

export const campoDe = (clave: ClaveCorreo, campo: string): DefCampo | undefined => PLANTILLAS[clave].campos.find((c) => c.clave === campo);

/** Los textos actuales del código, campo por campo. */
export function textosPorDefecto(clave: ClaveCorreo): Record<string, string> {
  return Object.fromEntries(PLANTILLAS[clave].campos.map((c) => [c.clave, c.defecto]));
}
