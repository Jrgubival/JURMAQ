/**
 * GET /api/admin/cotizaciones-arriendo/[id]/pdf
 *
 * Renderiza la cotización como HTML imprimible (el cliente lo guarda como PDF
 * vía "Imprimir → Guardar como PDF"). Misma técnica que /api/cotizaciones/[id]/pdf
 * de barraca — evita la complejidad de Chromium/Puppeteer headless en serverless.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { formatCLP } from '@jurmaq/shared/format';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('cotizaciones', 'read');
  if (!session) return forbiddenResponse('No autorizado');

  const { id } = await params;
  const { data: cot, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('*, maquinarias!inner(id, nombre)')
    .eq('id', parseInt(id, 10))
    .single();

  if (error || !cot) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }

  const fechaFmt = new Date(cot.fecha_servicio).toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows: string[] = [];
  if (cot.precio_uso > 0) {
    rows.push(`<tr><td>Uso de máquina</td><td>${formatCLP(cot.precio_uso)}</td></tr>`);
  }
  if (cot.traslado_combustible > 0) {
    rows.push(`<tr><td>Traslado combustible (${cot.distancia_km}km × 2)</td><td>${formatCLP(cot.traslado_combustible)}</td></tr>`);
  }
  if (cot.traslado_carga > 0) {
    rows.push(`<tr><td>Carga / descarga</td><td>${formatCLP(cot.traslado_carga)}</td></tr>`);
  }
  if (cot.traslado_operario > 0) {
    rows.push(`<tr><td>Operario (${cot.horas_operario_estimadas}h × ${cot.operarios})</td><td>${formatCLP(cot.traslado_operario)}</td></tr>`);
  }
  if (cot.peajes > 0) {
    rows.push(`<tr><td>Peajes</td><td>${formatCLP(cot.peajes)}</td></tr>`);
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cotización ${escapeHtml(cot.numero)}</title>
<style>
  @media print { @page { margin: 1.5cm; } body { font-size: 11pt; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; max-width: 800px; margin: 30px auto; padding: 0 20px; line-height: 1.5; }
  header { border-bottom: 3px solid #ea580c; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { color: #0c1d3a; font-size: 28px; margin: 0; }
  .subtitle { color: #6b7280; font-size: 13px; }
  .numero { font-family: 'Courier New', monospace; font-size: 18px; color: #ea580c; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 20px 0; }
  .info-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; }
  .info-block h3 { margin: 0 0 10px; font-size: 13px; color: #0c1d3a; text-transform: uppercase; letter-spacing: 0.05em; }
  .info-block dt { color: #6b7280; font-size: 12px; }
  .info-block dd { margin: 0 0 8px; font-weight: 600; }
  table.desglose { width: 100%; border-collapse: collapse; margin-top: 20px; }
  table.desglose td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
  table.desglose td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  table.desglose tr.subtotal td { font-weight: 700; padding-top: 14px; }
  table.desglose tr.iva td { color: #6b7280; }
  table.desglose tr.total td { font-size: 18px; font-weight: 700; color: #ea580c; padding: 14px 0; border-top: 2px solid #0c1d3a; border-bottom: none; }
  footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
  .print-btn { background: #0c1d3a; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-bottom: 16px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">📄 Imprimir / Guardar como PDF</button>

  <header>
    <div>
      <h1>JURMAQ</h1>
      <p class="subtitle">Constructora Jorge Ubilla Rivera E.I.R.L.</p>
    </div>
    <div style="text-align: right;">
      <p style="margin:0;font-size:13px;color:#6b7280;">COTIZACIÓN</p>
      <p class="numero">${escapeHtml(cot.numero)}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Emitida: ${new Date(cot.created_at).toLocaleDateString('es-CL')}</p>
    </div>
  </header>

  <div class="grid">
    <div class="info-block">
      <h3>Cliente</h3>
      <dd>${escapeHtml(cot.cliente_nombre)}</dd>
      <dt>Email</dt><dd>${escapeHtml(cot.cliente_email)}</dd>
      ${cot.cliente_telefono ? `<dt>Teléfono</dt><dd>${escapeHtml(cot.cliente_telefono)}</dd>` : ''}
      ${cot.cliente_rut ? `<dt>RUT</dt><dd>${escapeHtml(cot.cliente_rut)}</dd>` : ''}
      ${cot.cliente_empresa ? `<dt>Empresa</dt><dd>${escapeHtml(cot.cliente_empresa)}</dd>` : ''}
    </div>
    <div class="info-block">
      <h3>Servicio</h3>
      <dt>Maquinaria</dt><dd>${escapeHtml(cot.maquinarias?.nombre || '—')}</dd>
      <dt>Fecha</dt><dd>${escapeHtml(fechaFmt)}</dd>
      <dt>Ubicación</dt><dd>${escapeHtml(cot.ubicacion_servicio)}</dd>
      <dt>Duración</dt><dd>${cot.unidades_solicitadas} ${escapeHtml(cot.unidad)}${cot.unidades_solicitadas !== 1 ? 's' : ''}</dd>
    </div>
  </div>

  <h3 style="color:#0c1d3a;margin-top:24px;">Desglose</h3>
  <table class="desglose">
    ${rows.join('\n')}
    <tr class="subtotal"><td>Subtotal neto</td><td>${formatCLP(cot.subtotal_neto)}</td></tr>
    <tr class="iva"><td>IVA 19%</td><td>${formatCLP(cot.iva)}</td></tr>
    <tr class="total"><td>Total con IVA</td><td>${formatCLP(cot.total)}</td></tr>
  </table>

  ${cot.notas_cliente ? `<div style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:6px;font-size:13px;"><strong>Notas:</strong> ${escapeHtml(cot.notas_cliente)}</div>` : ''}

  <footer>
    <p><strong>Validez:</strong> esta cotización es válida por 30 días desde su emisión.</p>
    <p><strong>Términos:</strong> precios en pesos chilenos (CLP) incluyen IVA. Traslado incluido si la máquina lo requiere. El servicio se confirma al firmar el contrato de arriendo.</p>
    <p><strong>Contacto:</strong> contacto@jurmaq.cl · <a href="https://jurmaq.cl">jurmaq.cl</a></p>
  </footer>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
