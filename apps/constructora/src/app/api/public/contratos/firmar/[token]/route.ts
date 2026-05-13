import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { renderContrato } from '@/lib/contrato-render';
import { buildRenderVars } from '@/app/api/admin/contratos/_helpers';

/**
 * GET /api/public/contratos/firmar/[token]
 * Public endpoint (token = authentication). Returns the minimal contract info
 * plus the rendered HTML for the signature page.
 *
 * Sensitive fields (notas_internas, firma_ip, firma_hash, firma_user_agent,
 * firma_arrendatario, created_by_user_id) are NEVER returned here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Tokens are 64-char hex produced by crypto.randomBytes(32).toString('hex').
    // Reject anything that doesn't look like one to avoid accidental scans.
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 400 });
    }

    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(*)')
      .eq('firma_token', token)
      .single();

    if (error || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Surface a friendlier error if the contract is already closed.
    if (contrato.estado === 'anulado') {
      return NextResponse.json({ error: 'Este contrato fue anulado' }, { status: 410 });
    }

    // Token expiry (audit A2): cuando existe firma_token_expira_at y ya paso,
    // el link es invalido. El admin debe reenviar para generar token nuevo.
    if (contrato.firma_token_expira_at) {
      const expiraAt = new Date(contrato.firma_token_expira_at).getTime();
      if (Number.isFinite(expiraAt) && expiraAt < Date.now()) {
        return NextResponse.json({ error: 'Este enlace de firma vencio. Solicita al administrador que reenvie el contrato.' }, { status: 410 });
      }
    }

    // Pull template (prefer referenced; fall back to active).
    let template: { contenido: string } | null = null;
    if (contrato.template_id) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('contenido')
        .eq('id', contrato.template_id)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('contenido')
        .eq('activo', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      return NextResponse.json({ error: 'Template no disponible' }, { status: 500 });
    }

    const maquinaria = contrato.maquinarias ?? null;
    const vars = buildRenderVars(contrato, maquinaria);
    const html = renderContrato(template.contenido, vars);

    // Whitelist the fields we expose. Do NOT include notas_internas, firma_ip,
    // firma_hash, firma_user_agent, firma_arrendatario, created_by_user_id.
    const safeContrato = {
      numero: contrato.numero,
      estado: contrato.estado,
      arrendatario_tipo: contrato.arrendatario_tipo,
      arrendatario_nombre: contrato.arrendatario_nombre,
      arrendatario_razon_social: contrato.arrendatario_razon_social,
      arrendatario_rut: contrato.arrendatario_rut,
      arrendatario_email: contrato.arrendatario_email,
      // Masked telephone — we need the user to recognize it, but we shouldn't
      // publish the full number if the URL leaks. Show last 4 digits only.
      arrendatario_telefono_masked: maskPhone(contrato.arrendatario_telefono),
      fecha_inicio: contrato.fecha_inicio,
      fecha_termino: contrato.fecha_termino,
      precio_unidad: contrato.precio_unidad,
      precio_por_unidad: contrato.precio_por_unidad,
      precio_total: contrato.precio_total,
      garantia_monto: contrato.garantia_monto,
      direccion_entrega: contrato.direccion_entrega,
      direccion_retiro: contrato.direccion_retiro,
      con_operador: contrato.con_operador,
      operador_nombre: contrato.operador_nombre,
      observaciones: contrato.observaciones,
      firma_otp_verified: !!contrato.firma_otp_verified,
      // Identidad reforzada: el cliente debe haber subido cédula y RUT antes
      // de poder pedir el OTP. La UI usa este flag para saber si saltarse el
      // step de identidad o mostrarlo. NO incluimos la URL de la cédula —
      // solo si está subida o no, para no leakear el path del bucket privado.
      identidad_subida: !!(contrato.cedula_hash && contrato.rut_verified),
      firmado: contrato.estado === 'firmado' || contrato.estado === 'vigente',
      maquinaria: maquinaria
        ? {
            id: maquinaria.id,
            nombre: maquinaria.nombre,
            tipo: maquinaria.tipo,
          }
        : null,
    };

    // Flat response shape aligned with the public signature page expectations.
    // `cliente_nombre` and `cliente_telefono` are UI aliases (arrendatario display).
    const displayName = contrato.arrendatario_tipo === 'juridica'
      ? (contrato.arrendatario_razon_social || contrato.arrendatario_nombre || '')
      : (contrato.arrendatario_nombre || '');

    return NextResponse.json({
      ...safeContrato,
      cliente_nombre: displayName,
      cliente_telefono: safeContrato.arrendatario_telefono_masked,
      html,
      firmado_at: contrato.firma_timestamp || null,
      pdf_url: contrato.pdf_url || null,
    });
  } catch (error) {
    console.error('Error al obtener contrato por token:', error);
    return NextResponse.json({ error: 'Error al obtener contrato' }, { status: 500 });
  }
}

/** Mask phone digits except for the last 4 (e.g. "+56 ******7890"). */
function maskPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  const tail = digits.slice(-4);
  return '****' + tail;
}
