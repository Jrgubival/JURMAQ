import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { formatCLP } from "@jurmaq/shared/format";
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** HTML-escape untrusted user input to prevent XSS in the rendered PDF page. */
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Audit M2: IDs son sequenciales, enumerable. Cap a 20/min para
    // prevenir harvesting.
    const ip = getClientIp(request);
    const limiter = rateLimit(`cot-pdf:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { id } = await params;

    const { data: cotizacion, error } = await supabaseAdmin
      .from('barraca_cotizaciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cotizacion) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
        { status: 404 }
      );
    }

    // SECURITY: require admin session OR matching email query param
    // IDs are sequential so public access would be a PII leak (IDOR).
    const session = await auth();
    const emailParam = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || null;
    const emailMatches = !!emailParam && !!cotizacion.email && emailParam === String(cotizacion.email).trim().toLowerCase();
    if (!session && !emailMatches) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const TIPO_LABELS: Record<string, string> = { producto: 'Producto', flete: 'Flete', servicio: 'Servicio', descuento: 'Descuento', otro: 'Otro' };

    // Parse items JSON if string, calculate subtotal if missing
    let items: Array<{
      nombre: string;
      cantidad: number;
      precio: number;
      subtotal: number;
      medida?: string;
      tipo?: string;
      descuento?: number;
      descuento_monto?: number;
    }> = [];
    if (cotizacion.items) {
      const raw = typeof cotizacion.items === 'string'
        ? JSON.parse(cotizacion.items)
        : cotizacion.items;
      items = raw.map((item: any) => ({
        ...item,
        tipo: item.tipo || 'producto',
        descuento: item.descuento || 0,
        subtotal: (() => {
          const base = (item.precio || 0) * (item.cantidad || 1);
          if (item.descuento && item.descuento > 0) return Math.round(base * (1 - item.descuento / 100));
          if (item.descuento_monto && item.descuento_monto > 0) return Math.max(0, base - item.descuento_monto);
          return base;
        })(),
      }));
    }

    // Parse contraoferta items if they exist
    let contraofertaItems: Array<{
      nombre: string;
      cantidad: number;
      precio: number;
      subtotal: number;
    }> = [];
    if (cotizacion.contraoferta_items) {
      const rawC = typeof cotizacion.contraoferta_items === 'string'
        ? JSON.parse(cotizacion.contraoferta_items)
        : cotizacion.contraoferta_items;
      contraofertaItems = rawC.map((item: any) => ({
        ...item,
        subtotal: item.subtotal || ((item.precioContraoferta || item.precio) * item.cantidad),
      }));
    }

    const fechaCotizacion = cotizacion.created_at
      ? formatDate(cotizacion.created_at)
      : formatDate(new Date().toISOString());

    const validezFecha = cotizacion.created_at
      ? formatDate(
          new Date(
            new Date(cotizacion.created_at).getTime() + 15 * 24 * 60 * 60 * 1000
          ).toISOString()
        )
      : '';

    const itemsRows = items
      .map(
        (item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${escapeHtml(item.nombre)}${item.tipo !== 'producto' ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;margin-left:6px;background:${
          item.tipo === 'flete' ? '#dbeafe;color:#1d4ed8' :
          item.tipo === 'servicio' ? '#f3e8ff;color:#7e22ce' :
          item.tipo === 'descuento' ? '#fee2e2;color:#dc2626' :
          '#f3f4f6;color:#4b5563'
        }">${escapeHtml(TIPO_LABELS[item.tipo || ''] || item.tipo)}</span>` : ''}</td>
        <td class="center">${Number(item.cantidad) || 0}</td>
        <td class="right">${formatCLP(item.precio)}</td>
        <td class="center">${item.descuento && item.descuento > 0 ? `${Number(item.descuento)}%` : '\u2014'}</td>
        <td class="right bold">${formatCLP(item.subtotal)}</td>
      </tr>`
      )
      .join('');

    const hasContraoferta =
      contraofertaItems.length > 0 && cotizacion.contraoferta_total;

    const contraofertaSection = hasContraoferta
      ? `
      <div class="section contraoferta-section">
        <h3>Contraoferta</h3>
        ${cotizacion.contraoferta_mensaje ? `<p class="contraoferta-msg">${escapeHtml(cotizacion.contraoferta_mensaje)}</p>` : ''}
        <table class="items-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Cant.</th>
              <th class="right">Precio Unit.</th>
              <th class="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${contraofertaItems
              .map(
                (item, i) => `
            <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
              <td>${escapeHtml(item.nombre)}</td>
              <td class="center">${Number(item.cantidad) || 0}</td>
              <td class="right">${formatCLP(item.precio)}</td>
              <td class="right bold">${formatCLP(item.subtotal)}</td>
            </tr>`
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="total-label">Total Contraoferta</td>
              <td class="total-value">${formatCLP(cotizacion.contraoferta_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`
      : '';

    // estado is a fixed set of values so it's safe to use as CSS class, but escape for display
    const safeEstado = typeof cotizacion.estado === 'string' ? cotizacion.estado.replace(/[^a-z]/gi, '') : '';
    const estadoBadge = safeEstado
      ? `<span class="badge badge-${safeEstado}">${escapeHtml(safeEstado.charAt(0).toUpperCase() + safeEstado.slice(1))}</span>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotizacion ${escapeHtml(cotizacion.numero)} - JURMAQ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      background: #f3f4f6;
      line-height: 1.5;
    }
    .page {
      max-width: 800px;
      margin: 20px auto;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: #0c1d3a;
      color: #ffffff;
      padding: 32px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header-left .subtitle {
      color: #ea580c;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 13px;
      color: #d1d5db;
      line-height: 1.6;
    }
    .content {
      padding: 32px 40px;
    }
    .quote-info {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .quote-number {
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .quote-number strong {
      display: block;
      font-size: 24px;
      color: #ea580c;
      letter-spacing: 0;
    }
    .quote-meta {
      text-align: right;
      font-size: 13px;
      color: #6b7280;
    }
    .quote-meta span {
      display: block;
      margin-bottom: 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }
    .badge-pendiente { background: #fef3c7; color: #92400e; }
    .badge-aprobada, .badge-aceptada { background: #d1fae5; color: #065f46; }
    .badge-rechazada { background: #fee2e2; color: #991b1b; }
    .badge-contraoferta { background: #dbeafe; color: #1e40af; }
    .badge-pagada { background: #d1fae5; color: #065f46; }

    .client-info {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .client-info h3 {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .client-field {
      font-size: 14px;
    }
    .client-field .label {
      color: #6b7280;
      font-size: 12px;
    }
    .client-field .value {
      color: #1f2937;
      font-weight: 500;
    }

    .section { margin-bottom: 28px; }
    .section h3 {
      font-size: 16px;
      color: #0c1d3a;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table thead tr {
      background: #0c1d3a;
    }
    .items-table thead th {
      padding: 10px 14px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
    }
    .items-table tbody td {
      padding: 10px 14px;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .items-table .row-even { background: #ffffff; }
    .items-table .row-odd { background: #f9fafb; }
    .items-table tfoot td {
      padding: 14px;
      font-weight: 700;
    }
    .total-label {
      text-align: right;
      font-size: 15px;
      color: #0c1d3a;
    }
    .total-value {
      text-align: right;
      font-size: 20px;
      color: #ea580c;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 600; }

    .contraoferta-section {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
    }
    .contraoferta-section h3 { color: #1e40af; }
    .contraoferta-msg {
      font-size: 14px;
      color: #1e40af;
      font-style: italic;
      margin-bottom: 12px;
    }

    .payment-section {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .payment-section h3 {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .payment-methods {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .payment-method {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      font-size: 13px;
    }
    .payment-method strong {
      display: block;
      color: #0c1d3a;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .payment-method span {
      color: #6b7280;
    }

    .footer {
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer p { margin: 4px 0; }

    .print-bar {
      text-align: center;
      padding: 16px;
      background: #ffffff;
    }
    .print-btn {
      background: #ea580c;
      color: #ffffff;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover { background: #c2410c; }

    @media print {
      body { background: #ffffff; }
      .page {
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        max-width: none;
      }
      .print-bar { display: none; }
      .header { border-radius: 0; }
      .content { padding: 24px 32px; }
      .footer { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>

  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>JURMAQ</h1>
        <div class="subtitle">E.I.R.L.</div>
      </div>
      <div class="header-right">
        Av. Poniente 2157, Molina<br>
        Region del Maule, Chile<br>
        Tel: +56 9 7667 3577<br>
        contacto@jurmaq.cl
      </div>
    </div>

    <div class="content">
      <div class="quote-info">
        <div>
          <div class="quote-number">
            Cotizacion
            <strong>#${escapeHtml(cotizacion.numero)}</strong>
          </div>
        </div>
        <div class="quote-meta">
          <span><strong>Fecha:</strong> ${escapeHtml(fechaCotizacion)}</span>
          ${validezFecha ? `<span><strong>Validez:</strong> ${escapeHtml(validezFecha)}</span>` : ''}
          ${estadoBadge}
        </div>
      </div>

      <div class="client-info">
        <h3>Datos del Cliente</h3>
        <div class="client-grid">
          <div class="client-field">
            <div class="label">Nombre</div>
            <div class="value">${escapeHtml(cotizacion.nombre) || '-'}</div>
          </div>
          <div class="client-field">
            <div class="label">Empresa</div>
            <div class="value">${escapeHtml(cotizacion.empresa) || '-'}</div>
          </div>
          <div class="client-field">
            <div class="label">RUT</div>
            <div class="value">${escapeHtml(cotizacion.rut) || '-'}</div>
          </div>
          <div class="client-field">
            <div class="label">Email</div>
            <div class="value">${escapeHtml(cotizacion.email) || '-'}</div>
          </div>
          <div class="client-field">
            <div class="label">Telefono</div>
            <div class="value">${escapeHtml(cotizacion.telefono) || '-'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Detalle de Productos</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Cant.</th>
              <th class="right">Precio Unit.</th>
              <th class="center">Dto.</th>
              <th class="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="total-label">Total</td>
              <td class="total-value">${formatCLP(cotizacion.total || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${contraofertaSection}

      <div class="payment-section">
        <h3>Formas de Pago</h3>
        <div class="payment-methods">
          <div class="payment-method">
            <strong>Transferencia Bancaria</strong>
            <span>Datos enviados por correo al aprobar</span>
          </div>
          <div class="payment-method">
            <strong>MercadoPago</strong>
            <span>Tarjeta de credito/debito</span>
          </div>
          <div class="payment-method">
            <strong>Efectivo</strong>
            <span>Pago presencial en sucursal</span>
          </div>
          <div class="payment-method">
            <strong>Cheque</strong>
            <span>Consultar condiciones</span>
          </div>
        </div>
      </div>

      ${cotizacion.notas ? `
      <div class="section">
        <h3>Notas</h3>
        <p style="font-size: 14px; color: #4b5563; white-space: pre-wrap;">${escapeHtml(cotizacion.notas)}</p>
      </div>` : ''}
    </div>

    <div class="footer">
      <p><strong>JURMAQ E.I.R.L.</strong> - Av. Poniente 2157, Molina, Region del Maule, Chile</p>
      <p>Tel: +56 9 7667 3577 | contacto@jurmaq.cl</p>
      <p style="margin-top: 8px; font-style: italic;">Los precios son referenciales y pueden variar segun disponibilidad. Cotizacion valida por 15 dias.</p>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error al generar PDF de cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al generar la cotizacion' },
      { status: 500 }
    );
  }
}
