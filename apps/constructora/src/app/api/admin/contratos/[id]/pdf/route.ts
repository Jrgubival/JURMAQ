import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { renderContrato } from '@/lib/contrato-render';
import { buildRenderVars, injectFirmasIntoHtml } from '../../_helpers';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

/**
 * GET /api/admin/contratos/[id]/pdf
 * Returns the contract HTML with a print bar so the browser can "Save as PDF".
 * This mirrors the cotizaciones PDF route — Content-Type is text/html, not
 * application/pdf, because users print it themselves.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('contratos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const ip = getClientIp(request);
    const limiter = rateLimit(`contrato-pdf:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(*)')
      .eq('id', numericId)
      .single();

    if (error || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Pick template: the one on the contract first, else the active one.
    let template: { id: number; contenido: string } | null = null;
    if (contrato.template_id) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('id, contenido')
        .eq('id', contrato.template_id)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('id, contenido')
        .eq('activo', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      return NextResponse.json({ error: 'No hay template disponible' }, { status: 500 });
    }

    const maquinaria = contrato.maquinarias ?? null;
    const { searchParams } = new URL(request.url);
    // When ?unsigned=1 is passed, the admin wants a blank-signature copy to
    // print and sign manually. We null out firma_* so the template renders
    // the manual-signature block (blank lines) instead of the digital firma.
    const isUnsigned = searchParams.get('unsigned') === '1';
    const autoPrint = searchParams.get('print') === '1';
    const contratoForRender = isUnsigned
      ? {
          ...contrato,
          firma_arrendatario: null,
          firma_arrendador: null,
          firma_ip: null,
          firma_timestamp: null,
          firma_hash: null,
          firma_otp_verified: false,
        }
      : contrato;

    const vars = buildRenderVars(contratoForRender, maquinaria);
    const renderedRaw = renderContrato(template.contenido, vars);
    // Inyectar las dos firmas si están disponibles. Cuando ?unsigned=1, ambas
    // son null y el template mostrará líneas en blanco (versión imprimible
    // para firma manual de respaldo).
    const rendered = injectFirmasIntoHtml(renderedRaw, {
      firmaArrendador: isUnsigned ? null : contrato.firma_arrendador,
      firmaArrendatario: isUnsigned ? null : contrato.firma_arrendatario,
    });

    // Inject a "Print / Save as PDF" bar above the rendered contract.
    // The template already includes @media print + .no-print so the bar won't print.
    const unsignedNote = isUnsigned
      ? `<p style="margin:6px 0 0;color:#fbbf24;font-size:12px;">COPIA SIN FIRMA &mdash; para impresi&oacute;n y firma manual</p>`
      : '';
    const printBar = `
<div class="no-print" style="position:sticky;top:0;z-index:999;background:#0c1d3a;padding:12px 16px;text-align:center;">
  <button onclick="window.print()" style="background:#ea580c;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    Imprimir / Guardar como PDF
  </button>
  ${unsignedNote}
</div>
${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script>' : ''}`;

    // Inject just after the opening <body> tag if present; otherwise prepend.
    let html: string;
    if (rendered.includes('<body')) {
      html = rendered.replace(/<body([^>]*)>/i, `<body$1>${printBar}`);
    } else {
      html = printBar + rendered;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error al generar PDF de contrato:', error);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
