import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import {
  sanitizeString,
  isValidEmail,
  escapeLikePattern,
  isValidOrigin,
} from '@jurmaq/shared/sanitize';
import { hid } from '@jurmaq/shared/logging';
import crypto from 'crypto';

const ALLOWED_PRECIO_UNIDAD = new Set(['dia', 'semana', 'mes']);
const ALLOWED_TIPO = new Set(['natural', 'juridica']);

/**
 * GET /api/admin/contratos
 * List contracts, optionally filtered by estado, buscar, maquinaria_id.
 * Join against maquinarias to expose maquinaria_nombre on each row.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('contratos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const buscar = searchParams.get('buscar');
    const maquinariaId = searchParams.get('maquinaria_id');

    // Join maquinarias(nombre) so the UI can show the machine without a second call.
    let query = supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(id, nombre, tipo)')
      .order('created_at', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (maquinariaId) {
      const mid = parseInt(maquinariaId, 10);
      if (Number.isFinite(mid)) query = query.eq('maquinaria_id', mid);
    }

    if (buscar) {
      const safe = escapeLikePattern(buscar.trim());
      query = query.or(
        `arrendatario_nombre.ilike.%${safe}%,arrendatario_razon_social.ilike.%${safe}%,arrendatario_rut.ilike.%${safe}%,numero.ilike.%${safe}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten maquinaria_nombre for convenience while preserving the raw object.
    type Row = Record<string, unknown> & { maquinarias?: { nombre?: string } | null };
    const rows = (data || []).map((row) => {
      const r = row as Row;
      return {
        ...r,
        maquinaria_nombre: r.maquinarias?.nombre || null,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    return NextResponse.json(
      { error: 'Error al obtener contratos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contratos
 * Create a new contract in `borrador` status.
 * Generates numero (CON-YYYYMMDD-NNN), firma_token, links active template.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();

    // --- Required scalar fields ---
    const maquinariaIdRaw = body.maquinaria_id;
    const maquinariaId = typeof maquinariaIdRaw === 'number'
      ? maquinariaIdRaw
      : parseInt(String(maquinariaIdRaw || ''), 10);
    if (!Number.isFinite(maquinariaId) || maquinariaId <= 0) {
      return NextResponse.json({ error: 'maquinaria_id es requerido' }, { status: 400 });
    }

    const arrendatarioTipo = sanitizeString(body.arrendatario_tipo);
    if (!arrendatarioTipo || !ALLOWED_TIPO.has(arrendatarioTipo)) {
      return NextResponse.json(
        { error: 'arrendatario_tipo debe ser "natural" o "juridica"' },
        { status: 400 }
      );
    }

    const arrendatarioRut = sanitizeString(body.arrendatario_rut);
    const arrendatarioDomicilio = sanitizeString(body.arrendatario_domicilio);
    const arrendatarioTelefono = sanitizeString(body.arrendatario_telefono);
    const arrendatarioEmail = sanitizeString(body.arrendatario_email);

    if (!arrendatarioRut) return NextResponse.json({ error: 'arrendatario_rut es requerido' }, { status: 400 });
    if (!arrendatarioDomicilio) return NextResponse.json({ error: 'arrendatario_domicilio es requerido' }, { status: 400 });
    if (!arrendatarioTelefono) return NextResponse.json({ error: 'arrendatario_telefono es requerido' }, { status: 400 });
    if (!arrendatarioEmail) return NextResponse.json({ error: 'arrendatario_email es requerido' }, { status: 400 });
    if (!isValidEmail(arrendatarioEmail)) return NextResponse.json({ error: 'Email invalido' }, { status: 400 });

    // Name vs razon_social depending on tipo
    const arrendatarioNombre = sanitizeString(body.arrendatario_nombre);
    const arrendatarioRazonSocial = sanitizeString(body.razon_social || body.arrendatario_razon_social);
    if (arrendatarioTipo === 'natural' && !arrendatarioNombre) {
      return NextResponse.json({ error: 'arrendatario_nombre es requerido para persona natural' }, { status: 400 });
    }
    if (arrendatarioTipo === 'juridica' && !arrendatarioRazonSocial) {
      return NextResponse.json({ error: 'razon_social es requerida para persona juridica' }, { status: 400 });
    }

    // Juridica extras
    const arrendatarioProfesion = sanitizeString(body.arrendatario_profesion);
    const arrendatarioGiro = sanitizeString(body.arrendatario_giro);
    const arrendatarioRepLegal = sanitizeString(body.arrendatario_rep_legal);
    const arrendatarioRepRut = sanitizeString(body.arrendatario_rep_rut);
    if (arrendatarioTipo === 'juridica') {
      if (!arrendatarioRepLegal) {
        return NextResponse.json({ error: 'arrendatario_rep_legal es requerido para persona juridica' }, { status: 400 });
      }
      if (!arrendatarioRepRut) {
        return NextResponse.json({ error: 'arrendatario_rep_rut es requerido para persona juridica' }, { status: 400 });
      }
    }

    // Operator
    const conOperador = !!body.con_operador;
    const operadorNombre = sanitizeString(body.operador_nombre);
    if (conOperador && !operadorNombre) {
      return NextResponse.json({ error: 'operador_nombre es requerido cuando con_operador es true' }, { status: 400 });
    }

    // Dates
    const fechaInicio = sanitizeString(body.fecha_inicio);
    const fechaTermino = sanitizeString(body.fecha_termino);
    if (!fechaInicio || !fechaTermino) {
      return NextResponse.json({ error: 'fecha_inicio y fecha_termino son requeridas' }, { status: 400 });
    }
    const inicioDate = new Date(fechaInicio);
    const terminoDate = new Date(fechaTermino);
    if (isNaN(inicioDate.getTime()) || isNaN(terminoDate.getTime())) {
      return NextResponse.json({ error: 'Fechas invalidas' }, { status: 400 });
    }
    if (terminoDate.getTime() < inicioDate.getTime()) {
      return NextResponse.json({ error: 'fecha_termino no puede ser anterior a fecha_inicio' }, { status: 400 });
    }

    // Pricing
    const precioUnidad = sanitizeString(body.precio_unidad);
    if (!precioUnidad || !ALLOWED_PRECIO_UNIDAD.has(precioUnidad)) {
      return NextResponse.json(
        { error: 'precio_unidad debe ser "dia", "semana" o "mes"' },
        { status: 400 }
      );
    }
    const precioPorUnidad = Math.max(0, Math.round(Number(body.precio_por_unidad) || 0));
    const precioTotal = Math.max(0, Math.round(Number(body.precio_total) || 0));
    if (precioPorUnidad <= 0) {
      return NextResponse.json({ error: 'precio_por_unidad debe ser positivo' }, { status: 400 });
    }
    if (precioTotal <= 0) {
      return NextResponse.json({ error: 'precio_total debe ser positivo' }, { status: 400 });
    }
    const garantiaMonto = Math.max(0, Math.round(Number(body.garantia_monto) || 0));

    // Logistics
    const direccionEntrega = sanitizeString(body.direccion_entrega);
    if (!direccionEntrega) {
      return NextResponse.json({ error: 'direccion_entrega es requerida' }, { status: 400 });
    }
    const direccionRetiro = sanitizeString(body.direccion_retiro);
    const observaciones = sanitizeString(body.observaciones);

    // --- Verify referenced maquinaria exists ---
    const { data: maquinaria, error: mqError } = await supabaseAdmin
      .from('maquinarias')
      .select('id')
      .eq('id', maquinariaId)
      .single();
    if (mqError || !maquinaria) {
      return NextResponse.json({ error: 'Maquinaria no encontrada' }, { status: 404 });
    }

    // --- Determine active template ---
    const { data: template } = await supabaseAdmin
      .from('contratos_templates')
      .select('id')
      .eq('activo', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!template) {
      return NextResponse.json(
        { error: 'No hay template activo configurado' },
        { status: 500 }
      );
    }

    // --- Generate numero: CON-YYYYMMDD-NNN (next seq for today) ---
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const { count: countToday } = await supabaseAdmin
      .from('contratos')
      .select('*', { count: 'exact', head: true })
      .ilike('numero', `CON-${dateStr}-%`);
    const seq = String((countToday || 0) + 1).padStart(3, '0');
    const numero = `CON-${dateStr}-${seq}`;

    // --- Public signature token (hex, 64 chars) ---
    const firmaToken = crypto.randomBytes(32).toString('hex');

    const createdByUserId = session.user?.id ? parseInt(String(session.user.id), 10) : null;

    const insertData: Record<string, unknown> = {
      numero,
      template_id: template.id,
      maquinaria_id: maquinariaId,

      arrendatario_tipo: arrendatarioTipo,
      arrendatario_nombre: arrendatarioNombre,
      arrendatario_rut: arrendatarioRut,
      arrendatario_domicilio: arrendatarioDomicilio,
      arrendatario_telefono: arrendatarioTelefono,
      arrendatario_email: arrendatarioEmail,
      arrendatario_profesion: arrendatarioProfesion,
      arrendatario_razon_social: arrendatarioRazonSocial,
      arrendatario_giro: arrendatarioGiro,
      arrendatario_rep_legal: arrendatarioRepLegal,
      arrendatario_rep_rut: arrendatarioRepRut,

      con_operador: conOperador,
      operador_nombre: operadorNombre,

      fecha_inicio: fechaInicio,
      fecha_termino: fechaTermino,

      precio_unidad: precioUnidad,
      precio_por_unidad: precioPorUnidad,
      precio_total: precioTotal,
      garantia_monto: garantiaMonto,

      direccion_entrega: direccionEntrega,
      direccion_retiro: direccionRetiro,
      observaciones,

      estado: 'borrador',
      firma_token: firmaToken,
      created_by_user_id: Number.isFinite(createdByUserId) ? createdByUserId : null,
    };

    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(contrato, { status: 201 });
  } catch (error) {
    console.error('Error al crear contrato:', error);
    return NextResponse.json({ error: 'Error al crear contrato' }, { status: 500 });
  }
}
