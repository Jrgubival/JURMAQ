/**
 * PDF de cotización con el formato de Jorge, sin diseño propio. Se arma en el
 * navegador: no gasta CPU del Worker ni necesita Chromium.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { calcularTotales, subtotalLinea, textoCantidad, type UnidadLinea } from './cotizacion';
import { SITIO } from './sitio';

export interface CotizacionPdf {
  numero: string;
  fecha: string;
  correoEmpresa: string;
  cliente: {
    nombre: string;
    rut: string | null;
    contacto: string | null;
    correo: string | null;
    telefono: string | null;
    direccion: string | null;
  };
  servicio: { equipo: string; detalle: string | null; entrega: string | null; retiro: string | null };
  destino: { nombre: string | null; direccion: string | null } | null;
  lineas: { descripcion: string; detalle: string | null; cantidad: number; unidad: UnidadLinea; precio: number }[];
  descuento: number;
  validezDias: number | null;
  notas: string | null;
}

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 40;
const DERECHA = ANCHO - MARGEN;
const NEGRO = rgb(0.12, 0.12, 0.12);
const GRIS = rgb(0.38, 0.38, 0.38);
const LINEA = rgb(0.82, 0.82, 0.82);
const FONDO = rgb(0.93, 0.93, 0.93);

const clp = (n: number) => `$${new Intl.NumberFormat('es-CL').format(Math.round(n))}`;

/** Helvetica sólo admite WinAnsi: lo que no entra se reemplaza para que nunca falle. */
function limpio(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^ -~ -ÿ–—‘’“”•…]/g, '?');
}

function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of limpio(texto).split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && fuente.widthOfTextAtSize(prueba, tam) > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function generarPdf(c: CotizacionPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Cotización N.º ${c.numero}`);
  doc.setAuthor(SITIO.razonSocial);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

  let pagina: PDFPage = doc.addPage([ANCHO, ALTO]);
  let y = ALTO - 40;

  const escribir = (t: string, x: number, yy: number, tam: number, f: PDFFont = normal, color = NEGRO) =>
    pagina.drawText(limpio(t), { x, y: yy, size: tam, font: f, color });
  const aDerecha = (t: string, x: number, yy: number, tam: number, f: PDFFont = normal, color = NEGRO) =>
    escribir(t, x - f.widthOfTextAtSize(limpio(t), tam), yy, tam, f, color);
  const raya = (x1: number, x2: number, yy: number, color = LINEA, grosor = 0.6) =>
    pagina.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, color, thickness: grosor });

  const nuevaPagina = () => {
    pagina = doc.addPage([ANCHO, ALTO]);
    y = ALTO - 50;
  };

  // Encabezado
  escribir(SITIO.marca, MARGEN, y - 16, 21, negrita);
  aDerecha('COTIZACIÓN', DERECHA, y - 13, 16, negrita);
  aDerecha(`N.º ${c.numero}`, DERECHA, y - 34, 13, negrita);
  aDerecha(`Fecha de emisión: ${c.fecha}`, DERECHA, y - 52, 9.5, normal, GRIS);
  y -= 37;
  for (const t of [
    SITIO.razonSocial,
    `RUT ${SITIO.rut}`,
    `Giro: ${SITIO.giro}`,
    SITIO.direccion,
    `${SITIO.telefonoVisible}  |  ${c.correoEmpresa}`,
  ]) {
    escribir(t, MARGEN, y, 9.5, normal, GRIS);
    y -= 13;
  }
  y -= 10;
  raya(MARGEN, DERECHA, y, NEGRO, 0.8);
  y -= 19;

  // Cliente y Servicio
  const columna = 367;
  const inicio = y;
  escribir('CLIENTE', MARGEN, y, 8.5, negrita, GRIS);
  y -= 19;
  for (const l of partir(c.cliente.nombre, negrita, 11, 300)) {
    escribir(l, MARGEN, y, 11, negrita);
    y -= 15;
  }
  y -= 1;
  const datos = [
    c.cliente.rut ? `RUT ${c.cliente.rut}` : null,
    c.cliente.contacto ? `Contacto: ${c.cliente.contacto}` : null,
    c.cliente.correo ? `Correo: ${c.cliente.correo}` : null,
    c.cliente.telefono ? `Teléfono: ${c.cliente.telefono}` : null,
    c.cliente.direccion,
  ].filter((x): x is string => !!x);
  for (const t of datos) {
    for (const l of partir(t, normal, 9.5, 310)) {
      escribir(l, MARGEN, y, 9.5, normal, GRIS);
      y -= 16;
    }
  }
  let yd = inicio;
  escribir('SERVICIO', columna, yd, 8.5, negrita, GRIS);
  yd -= 19;
  const servicio = [
    c.servicio.equipo,
    c.servicio.detalle,
    c.servicio.entrega ? `Entrega: ${c.servicio.entrega}` : null,
    c.servicio.retiro ? `Retiro: ${c.servicio.retiro}` : null,
    'Valores netos + IVA',
  ].filter((x): x is string => !!x);
  for (const [i, t] of servicio.entries()) {
    for (const l of partir(t, normal, 9.5, DERECHA - columna)) {
      escribir(l, columna, yd, 9.5, normal, i === 0 ? NEGRO : GRIS);
      yd -= 16;
    }
  }
  y = Math.min(y, yd) - 5;

  if (c.destino) {
    escribir('DESTINO', MARGEN, y, 8.5, negrita, GRIS);
    y -= 17;
    if (c.destino.nombre) {
      escribir(c.destino.nombre, MARGEN, y, 9.5, negrita);
      y -= 16;
    }
    if (c.destino.direccion) {
      for (const l of partir(c.destino.direccion, normal, 9.5, DERECHA - MARGEN)) {
        escribir(l, MARGEN, y, 9.5, normal, GRIS);
        y -= 14;
      }
    }
    y -= 12;
  } else {
    y -= 6;
  }

  // Tabla
  const xCant = 375;
  const xPrecio = 465;
  const xMonto = DERECHA - 6;
  const encabezado = () => {
    pagina.drawRectangle({ x: MARGEN, y: y - 22, width: DERECHA - MARGEN, height: 22, color: FONDO });
    escribir('Descripción', MARGEN + 6, y - 15, 9, negrita);
    aDerecha('Cantidad', xCant, y - 15, 9, negrita);
    aDerecha('Precio unit.', xPrecio, y - 15, 9, negrita);
    aDerecha('Monto', xMonto, y - 15, 9, negrita);
    y -= 22;
  };
  encabezado();
  for (const l of c.lineas) {
    const desc = partir(l.descripcion, normal, 9.5, xCant - 70 - MARGEN);
    const det = l.detalle ? partir(l.detalle, normal, 8, xCant - 70 - MARGEN) : [];
    const alto = 30 + (desc.length - 1) * 12 + det.length * 12;
    if (y - alto < 170) {
      nuevaPagina();
      encabezado();
    }
    let yl = y - 21;
    aDerecha(textoCantidad(l.cantidad, l.unidad), xCant, yl, 9.5);
    aDerecha(clp(l.precio), xPrecio, yl, 9.5);
    aDerecha(clp(subtotalLinea({ cantidad: l.cantidad, precio_unitario: l.precio })), xMonto, yl, 9.5, negrita);
    for (const t of desc) {
      escribir(t, MARGEN + 6, yl, 9.5);
      yl -= 12;
    }
    for (const t of det) {
      escribir(t, MARGEN + 6, yl - 1, 8, normal, GRIS);
      yl -= 12;
    }
    y -= alto + 3;
    raya(MARGEN, DERECHA, y);
  }

  // Totales
  const totales = calcularTotales(
    c.lineas.map((l) => ({ tipo: 'otro', cantidad: l.cantidad, precio_unitario: l.precio })),
    c.descuento,
  );
  const xEtiqueta = columna;
  y -= 21;
  if (c.descuento > 0) {
    escribir('Subtotal', xEtiqueta, y, 10.5, normal, GRIS);
    aDerecha(clp(totales.bruto), xMonto, y, 10.5, normal, GRIS);
    y -= 18;
    escribir('Descuento', xEtiqueta, y, 10.5, normal, GRIS);
    aDerecha(`-${clp(c.descuento)}`, xMonto, y, 10.5, normal, GRIS);
    y -= 18;
  }
  escribir('Neto', xEtiqueta, y, 10.5, normal, GRIS);
  aDerecha(clp(totales.neto), xMonto, y, 10.5, normal, GRIS);
  y -= 18;
  escribir('IVA 19%', xEtiqueta, y, 10.5, normal, GRIS);
  aDerecha(clp(totales.iva), xMonto, y, 10.5, normal, GRIS);
  y -= 9;
  raya(xEtiqueta, xMonto, y, NEGRO, 0.8);
  y -= 19;
  escribir('TOTAL', xEtiqueta, y, 15, negrita);
  aDerecha(clp(totales.total), xMonto, y, 15, negrita);
  y -= 26;

  // El formato de Jorge no trae este bloque: se agrega abajo, sin mover lo demás.
  const notas = [
    c.validezDias ? `Validez de la cotización: ${c.validezDias} días.` : null,
    c.notas,
  ].filter((x): x is string => !!x);
  for (const n of notas) {
    for (const l of partir(n, normal, 9, DERECHA - MARGEN)) {
      if (y < 60) nuevaPagina();
      escribir(l, MARGEN, y, 9, normal, GRIS);
      y -= 13;
    }
  }

  // Pie
  doc.getPages().forEach((p, i) => {
    p.drawLine({ start: { x: MARGEN, y: 40 }, end: { x: DERECHA, y: 40 }, color: LINEA, thickness: 0.6 });
    p.drawText(limpio(`Cotización N.º ${c.numero} · ${SITIO.marca}`), { x: MARGEN, y: 27, size: 8, font: normal, color: GRIS });
    const t = `Página ${i + 1}`;
    p.drawText(limpio(t), { x: DERECHA - normal.widthOfTextAtSize(limpio(t), 8), y: 27, size: 8, font: normal, color: GRIS });
  });

  return doc.save();
}
