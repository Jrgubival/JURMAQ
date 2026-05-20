import 'server-only';
import { formatCLP } from "@jurmaq/shared/format";
import {
  formatDate,
  numberToSpanishWords,
  daysBetween,
  type ContratoVars,
} from '@/lib/contrato-render';

/**
 * Row shape for a contract record (loose: the DB may have more columns).
 * Kept as a Record for forward compatibility with template/DB changes.
 */
export type ContratoRow = Record<string, unknown>;
export type MaquinariaRow = Record<string, unknown>;

/**
 * Constant arrendador data (JURMAQ). Used by both render and pdf routes.
 */
export const JURMAQ_ARRENDADOR = {
  razon_social: 'Constructora Jorge Ubilla Rivera E.I.R.L.',
  rut: '76.624.872-1',
  domicilio: 'Lote 3 del lote A, HJ 11, Maquehua, Curico, Region del Maule',
  telefono: '+56 9 7667 3577',
  email: 'contacto@jurmaq.cl',
  rep_legal: 'Jorge Ubilla Rivera',
} as const;

/**
 * Safely coerce an unknown into a string for template substitution.
 * null/undefined collapse to ''. Numbers and booleans are stringified.
 */
function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/**
 * Safely coerce to integer. Non-numeric values return 0.
 */
function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parse maquinaria.especificaciones JSON if present (it's stored as JSON string).
 */
function parseEspec(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Build the template variables dict used by renderContrato().
 * Centralises the mapping between DB columns and template placeholders so
 * that the render and pdf routes share identical logic.
 *
 * Extra runtime signature metadata (firma_hash, firma_ip, otp_codigo,
 * firma_timestamp, firma_telefono) can be merged in by the caller.
 */
export function buildRenderVars(
  contrato: ContratoRow,
  maquinaria: MaquinariaRow | null
): ContratoVars {
  const especificaciones = parseEspec(maquinaria?.especificaciones);

  const esNatural = contrato.arrendatario_tipo === 'natural';

  const fechaInicioIso = s(contrato.fecha_inicio);
  const fechaTerminoIso = s(contrato.fecha_termino);
  const diasArriendo = fechaInicioIso && fechaTerminoIso
    ? Math.max(1, daysBetween(fechaInicioIso, fechaTerminoIso))
    : 0;

  const precioTotal = n(contrato.precio_total);
  const garantiaMonto = n(contrato.garantia_monto);

  // "Ciudad" where the contract is signed — JURMAQ HQ is in Curico.
  const ciudad = 'Curico';

  // Fecha del contrato: when it was created (or today if missing).
  const fechaContratoIso = s(contrato.created_at) || new Date().toISOString();

  const vars: ContratoVars = {
    // Metadata
    numero_contrato: s(contrato.numero),
    fecha_contrato: formatDate(fechaContratoIso),
    ciudad_contrato: ciudad,

    // Arrendador (JURMAQ, constant)
    arrendador_razon_social: JURMAQ_ARRENDADOR.razon_social,
    arrendador_rut: JURMAQ_ARRENDADOR.rut,
    arrendador_domicilio: JURMAQ_ARRENDADOR.domicilio,
    arrendador_telefono: JURMAQ_ARRENDADOR.telefono,
    arrendador_email: JURMAQ_ARRENDADOR.email,
    arrendador_rep_legal: JURMAQ_ARRENDADOR.rep_legal,

    // Arrendatario
    es_natural: esNatural,
    arrendatario_tipo: s(contrato.arrendatario_tipo),
    arrendatario_nombre: s(contrato.arrendatario_nombre),
    arrendatario_rut: s(contrato.arrendatario_rut),
    arrendatario_domicilio: s(contrato.arrendatario_domicilio),
    arrendatario_telefono: s(contrato.arrendatario_telefono),
    arrendatario_email: s(contrato.arrendatario_email),
    arrendatario_profesion: s(contrato.arrendatario_profesion),
    arrendatario_razon_social: s(contrato.arrendatario_razon_social),
    arrendatario_giro: s(contrato.arrendatario_giro),
    arrendatario_rep_legal: s(contrato.arrendatario_rep_legal),
    arrendatario_rep_rut: s(contrato.arrendatario_rep_rut),

    // Maquinaria — pulled from the maquinarias row or its especificaciones JSON.
    maquinaria_nombre: s(maquinaria?.nombre),
    maquinaria_marca: s(especificaciones.marca),
    maquinaria_modelo: s(especificaciones.modelo),
    maquinaria_serie: s(especificaciones.serie || especificaciones.numero_serie),
    maquinaria_anio: s(especificaciones.anio || especificaciones.ano || especificaciones.year),
    maquinaria_descripcion: s(maquinaria?.descripcion),

    // Contract terms
    con_operador: !!contrato.con_operador,
    operador_nombre: s(contrato.operador_nombre),
    fecha_inicio: formatDate(fechaInicioIso),
    fecha_termino: formatDate(fechaTerminoIso),
    dias_arriendo: diasArriendo,
    precio_unidad: s(contrato.precio_unidad),
    precio_por_unidad: formatCLP(n(contrato.precio_por_unidad)).replace(/^\$/, ''),
    precio_total: formatCLP(precioTotal).replace(/^\$/, ''),
    precio_total_letras: numberToSpanishWords(precioTotal) + ' pesos chilenos',
    garantia_monto: formatCLP(garantiaMonto).replace(/^\$/, ''),
    garantia_monto_letras: numberToSpanishWords(garantiaMonto) + ' pesos chilenos',

    // Cláusula adicional Klap: solo se inyecta si garantia_metodo='klap_hold'.
    // Sirve como base legal para (a) la pre-autorización en tarjeta, (b) las
    // renovaciones automáticas del hold y (c) los cargos off-session por
    // daños descubiertos hasta 90 días post-devolución.
    garantia_klap_clausula:
      (contrato as unknown as { garantia_metodo?: string }).garantia_metodo === 'klap_hold'
        ? `<p>
      Cuando la garantía se constituya mediante <strong>pre-autorización en tarjeta de crédito</strong> (sistema Klap),
      el ARRENDATARIO autoriza expresamente al ARRENDADOR a: (a) <em>pre-autorizar (retener sin cobrar)</em> en su
      tarjeta de crédito el monto antes indicado como garantía por el cumplimiento de este contrato y por
      eventuales daños o pérdidas en la maquinaria arrendada; (b) <em>renovar</em> dicha pre-autorización
      automáticamente las veces que sean necesarias durante la vigencia del contrato; (c) <em>capturar</em>
      parcial o totalmente la pre-autorización en caso de daños comprobados, con respaldo fotográfico y/o informe
      técnico; y (d) <em>realizar cargos adicionales</em> en su tarjeta de crédito hasta noventa (90) días
      posteriores a la fecha de devolución por daños descubiertos con posterioridad a la entrega, con
      notificación previa por correo electrónico al ARRENDATARIO. El ARRENDATARIO declara conocer y aceptar
      que su tarjeta queda registrada como medio de pago (card-on-file) para los efectos antes señalados,
      siendo el procesador certificado PCI DSS Klap (Multicaja Pagos S.A.) responsable del resguardo del
      número de tarjeta. El ARRENDADOR únicamente almacena un token sustituto, que no es utilizable fuera
      del flujo descrito.
    </p>`
        : '',

    // Entrega/retiro
    direccion_entrega: s(contrato.direccion_entrega),
    direccion_retiro: s(contrato.direccion_retiro) || s(contrato.direccion_entrega),

    // Observaciones
    observaciones: s(contrato.observaciones),

    // Requisitos de seguros exigibles al arrendatario.
    // Monto mínimo de póliza de Responsabilidad Civil de Obra (en UF) que debe contratar
    // el arrendatario conforme a la cláusula 10.3. Por defecto 2.000 UF — cobertura estándar
    // de mercado para equipos de construcción de porte medio. Puede elevarse en observaciones
    // para faenas de mayor exposición (demolición, excavación profunda, grúas en ciudad).
    seguro_rc_obra_uf_min: s(contrato.seguro_rc_obra_uf_min) || '2.000',

    // Signature metadata (filled when signed)
    hash_sha256: s(contrato.firma_hash),
    otp_codigo: contrato.firma_otp_verified ? 'VERIFICADO' : '',
    firma_ip: s(contrato.firma_ip),
    firma_timestamp: contrato.firma_timestamp ? formatDate(s(contrato.firma_timestamp)) : '',
    firma_email: s(contrato.arrendatario_email),

    // Firma del arrendatario (canvas base64) — se inyecta directo como <img src="..."/>.
    // Si está vacía, el template puede mostrar la línea de firma vacía con
    // {{#if firma_arrendatario_imagen}}.
    firma_arrendatario_imagen: s(contrato.firma_arrendatario),

    // Firma del arrendador (JURMAQ) — capturada por el admin desde el panel.
    firma_arrendador_imagen: s(contrato.firma_arrendador),
    firma_arrendador_nombre: s(contrato.firma_arrendador_nombre) || 'Constructora Jorge Ubilla Rivera E.I.R.L.',
    firma_arrendador_at: contrato.firma_arrendador_at ? formatDate(s(contrato.firma_arrendador_at)) : '',
  };

  return vars;
}

/**
 * Reemplaza los `<div class="signature-line">&nbsp;</div>` del template
 * con las imágenes de firma reales cuando están disponibles.
 *
 * El template tiene DOS divs con esa clase, en ese orden:
 *   1. Arrendador (JURMAQ) — la primera ocurrencia.
 *   2. Arrendatario (cliente) — la segunda ocurrencia.
 *
 * Si una firma no está disponible, el div queda como línea vacía (estado
 * pre-firma). Si ambas están, ambas se renderizan.
 *
 * Centralizado acá para que sign/route, render/route, pdf/route y
 * send-signature/route compartan el comportamiento exacto. Sin esto, cada
 * endpoint reinventaba su propia lógica y aparecían bugs sutiles (e.g. el
 * PDF mostraba la firma del cliente pero no la de JURMAQ).
 */
export function injectFirmasIntoHtml(
  html: string,
  opts: {
    firmaArrendador?: string | null;
    firmaArrendatario?: string | null;
  }
): string {
  const block = (b64: string, alt: string) =>
    `<div class="signature-line" style="display:flex;align-items:flex-end;justify-content:center;height:60px;border-bottom:1px solid #94a3b8;"><img src="${b64}" alt="${alt}" style="max-width:240px;max-height:60px;" /></div>`;

  let occurrence = 0;
  return html.replace(
    /<div class="signature-line">&nbsp;<\/div>/g,
    (match) => {
      occurrence++;
      if (occurrence === 1 && opts.firmaArrendador) {
        return block(opts.firmaArrendador, 'Firma representante JURMAQ');
      }
      if (occurrence === 2 && opts.firmaArrendatario) {
        return block(opts.firmaArrendatario, 'Firma electrónica del arrendatario');
      }
      return match;
    }
  );
}

/**
 * HTML-escape untrusted content for embedding in rendered HTML outside of the
 * {{var}} substitution path (e.g., when we inject snippets directly).
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
