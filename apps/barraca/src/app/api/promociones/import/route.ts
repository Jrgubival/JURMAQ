import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import {
  PRECIO_ITEM_MAX,
  MIN_DIAS_VIGENCIA,
  VENTANA_DIAS,
  COLUMN_SYNONYMS,
  type ParsedRow,
  type RowDiagnostic,
  detectColumnMapping,
  parseExcelBuffer,
  coerceFechaFin,
  coerceCodigo,
  coercePrecio,
} from '@/lib/promociones-import-helpers';

// Hasta 5000 filas validan ~5000 RPCs serializados; en Vercel Hobby el
// timeout default es 10s y aqui tomaria minutos. Subimos el cap y
// paralelizamos en chunks (ver buildDiagnostics).
export const maxDuration = 60;

/**
 * Modulo unico de promociones por Excel (Ley 19.496 art. 28 compatible).
 *
 * Reemplaza el viejo "Crear Promocion Ficticia" que inflaba precios. Ahora el
 * admin sube un Excel con codigos y precios promocionales (menores al precio
 * actual). El sistema valida cada fila contra el historial de precios y aplica
 * solo las que cumplen 30 dias de vigencia previa.
 *
 * Tres modos en un solo endpoint:
 *   - mode=preview  -> parsea el Excel, devuelve diagnostico fila por fila
 *   - mode=execute  -> aplica las filas que pasan validacion
 *   - mode=expire   -> revierte ofertas cuya oferta_fin < hoy
 *
 * Excel esperado (acepta sinonimos en headers, mayusculas/min indistinto):
 *   - codigo            (req)  ej. "FE-001", "ACH-12mm"
 *   - precio_promocional (req) numero CLP, debe ser < precio actual del producto
 *   - fecha_fin         (opt)  YYYY-MM-DD; cuando llega esa fecha la oferta
 *                              se revierte sola en el siguiente expire run.
 *
 * Sinonimos soportados: codigo|sku|cod, precio_promocional|precio_oferta|precio_promo,
 * fecha_fin|valido_hasta|hasta|vence.
 */

async function buildDiagnostics(parsedRows: ParsedRow[]): Promise<RowDiagnostic[]> {
  // Bulk lookup: una sola query por todos los codigos.
  const codigos = Array.from(new Set(parsedRows.map((r) => r.codigo).filter(Boolean)));
  const { data: productos } = codigos.length > 0
    ? await supabaseAdmin
        .from('barraca_productos')
        .select('id, codigo, precio, en_oferta, activo')
        .in('codigo', codigos)
    : { data: [] };
  const byCodigo = new Map<string, { id: number; codigo: string; precio: number; en_oferta: boolean; activo: boolean }>();
  for (const p of (productos ?? [])) byCodigo.set(p.codigo, p);

  // Cache de validaciones de historial: precio actual de un mismo producto
  // genera la misma respuesta de RPC, asi evitamos llamadas duplicadas si
  // el Excel tiene varias filas para el mismo codigo (improbable pero posible).
  const historialCache = new Map<string, { dias: number; rpcErrCode?: string; rpcErrMsg?: string }>();
  const PARALLEL_RPC_CHUNK = 25;
  const rpcKey = (id: number, precio: number) => `${id}:${precio}`;
  // Pre-resolver historial en paralelo por chunks. Cada chunk ejecuta hasta
  // PARALLEL_RPC_CHUNK RPCs concurrentes; luego espera y pasa al siguiente.
  // Esto cambia O(N) latencia secuencial a ~ceil(N/25) batches.
  const productosToValidate = parsedRows
    .map((r) => byCodigo.get(r.codigo))
    .filter((p): p is NonNullable<typeof p> => !!p && p.activo && !p.en_oferta);
  const uniqProductos = Array.from(
    new Map(productosToValidate.map((p) => [rpcKey(p.id, p.precio), p])).values()
  );
  for (let i = 0; i < uniqProductos.length; i += PARALLEL_RPC_CHUNK) {
    const chunk = uniqProductos.slice(i, i + PARALLEL_RPC_CHUNK);
    const results = await Promise.all(
      chunk.map((p) =>
        supabaseAdmin.rpc('precio_vigente_acumulado_dias', {
          p_producto_id: p.id,
          p_precio: p.precio,
          p_ventana_dias: VENTANA_DIAS,
        })
      )
    );
    chunk.forEach((p, idx) => {
      const r = results[idx];
      if (r.error) {
        historialCache.set(rpcKey(p.id, p.precio), {
          dias: 0,
          rpcErrCode: (r.error as { code?: string }).code,
          rpcErrMsg: (r.error as { message?: string }).message || '',
        });
      } else {
        historialCache.set(rpcKey(p.id, p.precio), { dias: Number(r.data ?? 0) });
      }
    });
  }

  const out: RowDiagnostic[] = [];
  for (const row of parsedRows) {
    const base: RowDiagnostic = {
      rowIndex: row.rowIndex,
      codigo: row.codigo,
      precio_promocional: row.precio_promocional,
      fecha_fin: row.fecha_fin,
      status: 'reject',
    };
    if (!row.codigo) {
      out.push({ ...base, reason: 'codigo vacio' });
      continue;
    }
    if (!row.precio_promocional || row.precio_promocional <= 0) {
      out.push({ ...base, reason: 'precio_promocional invalido' });
      continue;
    }
    if (row.precio_promocional > PRECIO_ITEM_MAX) {
      out.push({ ...base, reason: `precio excede maximo ${PRECIO_ITEM_MAX}` });
      continue;
    }
    if (row.fecha_fin) {
      const today = new Date().toISOString().slice(0, 10);
      if (row.fecha_fin < today) {
        out.push({ ...base, reason: `fecha_fin (${row.fecha_fin}) ya paso` });
        continue;
      }
    }
    const producto = byCodigo.get(row.codigo);
    if (!producto) {
      out.push({ ...base, reason: 'producto no encontrado' });
      continue;
    }
    if (!producto.activo) {
      out.push({ ...base, productoId: producto.id, reason: 'producto inactivo' });
      continue;
    }
    if (producto.en_oferta) {
      out.push({ ...base, productoId: producto.id, precioActual: producto.precio, reason: 'ya esta en oferta (revertir primero)' });
      continue;
    }
    if (row.precio_promocional >= producto.precio) {
      out.push({
        ...base,
        productoId: producto.id,
        precioActual: producto.precio,
        reason: `precio_promocional (${row.precio_promocional}) debe ser MENOR al precio actual (${producto.precio}). Inflar precios viola Ley 19.496 art. 28.`,
      });
      continue;
    }
    // Validacion 30 dias via cache pre-poblado en paralelo (ver arriba).
    const cached = historialCache.get(rpcKey(producto.id, producto.precio));
    if (cached?.rpcErrCode) {
      const code = cached.rpcErrCode;
      const msg = cached.rpcErrMsg || '';
      if (code === 'PGRST202' || /precio_vigente_acumulado_dias/.test(msg)) {
        out.push({ ...base, productoId: producto.id, precioActual: producto.precio, reason: 'falta migrate-precio-historial.sql en Supabase' });
      } else {
        out.push({ ...base, productoId: producto.id, precioActual: producto.precio, reason: `error validacion historial: ${msg}` });
      }
      continue;
    }
    const diasNum = cached?.dias ?? 0;
    if (diasNum < MIN_DIAS_VIGENCIA) {
      out.push({
        ...base,
        productoId: producto.id,
        precioActual: producto.precio,
        diasVigencia: diasNum,
        reason: `precio actual solo estuvo vigente ${diasNum}/${MIN_DIAS_VIGENCIA} dias requeridos (Ley 19.496 art. 28)`,
      });
      continue;
    }
    out.push({
      ...base,
      status: 'ok',
      productoId: producto.id,
      precioActual: producto.precio,
      diasVigencia: diasNum,
      descuento: Math.round((1 - row.precio_promocional / producto.precio) * 100),
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_precios', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const ip = getClientIp(request);
  const rl = rateLimit(`promos-import:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un minuto.' }, { status: 429 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'preview';

  // -------- MODE: expire --------
  // Revierte ofertas vencidas (oferta_fin < hoy). Idempotente — se puede llamar
  // desde un cron Vercel diario o desde la home admin como botoncito "ahora".
  if (mode === 'expire') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: vencidas, error: fetchErr } = await supabaseAdmin
      .from('barraca_productos')
      .select('id, codigo, nombre, precio, precio_original, oferta_fin')
      .eq('en_oferta', true)
      .not('oferta_fin', 'is', null)
      .lt('oferta_fin', today);
    if (fetchErr) {
      const code = (fetchErr as { code?: string }).code;
      const msg = (fetchErr as { message?: string }).message || '';
      if (code === 'PGRST204' || /oferta_fin/.test(msg)) {
        return NextResponse.json(
          { error: 'Falta migrate-oferta-fin.sql en Supabase' },
          { status: 503 }
        );
      }
      throw fetchErr;
    }
    const lista = vencidas ?? [];
    if (lista.length === 0) {
      return NextResponse.json({ mode: 'expire', revertidas: 0, items: [] });
    }
    const results = await Promise.all(
      lista.map((p) =>
        supabaseAdmin
          .from('barraca_productos')
          .update({
            precio: p.precio_original ?? p.precio,
            precio_original: null,
            en_oferta: false,
            oferta_fin: null,
          })
          .eq('id', p.id)
          .eq('en_oferta', true)
      )
    );
    const ok = lista.filter((_, i) => !results[i].error);
    return NextResponse.json({
      mode: 'expire',
      revertidas: ok.length,
      items: ok.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, oferta_fin: p.oferta_fin })),
    });
  }

  // -------- MODE: preview / execute (require Excel upload) --------
  let parsedRows: ParsedRow[] = [];
  let detectedMapping: Partial<Record<keyof typeof COLUMN_SYNONYMS, string>> = {};
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Sube el Excel como multipart/form-data (campo "file")' }, { status: 400 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Archivo vacio' }, { status: 400 });
    }
    if (file.size > 5_000_000) {
      return NextResponse.json({ error: 'Archivo excede 5MB' }, { status: 413 });
    }
    const buffer = await file.arrayBuffer();
    const { headers, rows } = parseExcelBuffer(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel sin filas o sin headers reconocibles' }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json({ error: `Maximo 5000 filas por archivo (recibidas ${rows.length})` }, { status: 400 });
    }
    detectedMapping = detectColumnMapping(headers);
    if (!detectedMapping.codigo || !detectedMapping.precio_promocional) {
      return NextResponse.json({
        error: 'Excel debe tener columnas "codigo" y "precio_promocional" (o sinonimos). Detectado: ' + JSON.stringify(detectedMapping),
        detectedHeaders: headers,
      }, { status: 400 });
    }
    parsedRows = rows.map((r, i) => ({
      rowIndex: i + 2, // +2 porque headers es fila 1 y 0-indexed
      codigo: coerceCodigo(r[detectedMapping.codigo!]),
      precio_promocional: coercePrecio(r[detectedMapping.precio_promocional!]),
      fecha_fin: detectedMapping.fecha_fin ? coerceFechaFin(r[detectedMapping.fecha_fin]) : null,
      rawRow: r,
    }));
  } catch (err) {
    console.error('[promos-import] error parseando Excel:', err);
    return NextResponse.json({ error: 'No se pudo parsear el Excel' }, { status: 400 });
  }

  const diagnostics = await buildDiagnostics(parsedRows);
  const okRows = diagnostics.filter((d) => d.status === 'ok');
  const rejectRows = diagnostics.filter((d) => d.status === 'reject');

  if (mode === 'preview') {
    return NextResponse.json({
      mode: 'preview',
      detected: detectedMapping,
      total: diagnostics.length,
      ok: okRows.length,
      reject: rejectRows.length,
      rows: diagnostics,
    });
  }

  if (mode === 'execute') {
    if (okRows.length === 0) {
      return NextResponse.json({
        mode: 'execute',
        applied: 0,
        rejected: rejectRows.length,
        rows: diagnostics,
      });
    }
    // Aplica solo las filas validas. Con .eq('en_oferta', false) como guard
    // anti-race en caso de que entre preview y execute alguien activara la oferta.
    const updates = await Promise.all(
      okRows.map((row) =>
        supabaseAdmin
          .from('barraca_productos')
          .update({
            precio_original: row.precioActual!,
            precio: row.precio_promocional,
            en_oferta: true,
            oferta_fin: row.fecha_fin,
          })
          .eq('id', row.productoId!)
          .eq('en_oferta', false)
          .select('id')
      )
    );
    const applied = updates.filter((r) => !r.error && r.data && r.data.length > 0).length;
    const failedRowsByIdx = new Set<number>();
    okRows.forEach((row, i) => {
      const r = updates[i];
      if (r.error || !r.data || r.data.length === 0) {
        failedRowsByIdx.add(row.rowIndex);
      }
    });
    return NextResponse.json({
      mode: 'execute',
      applied,
      rejected: rejectRows.length,
      failedAtUpdate: failedRowsByIdx.size,
      rows: diagnostics.map((d) =>
        failedRowsByIdx.has(d.rowIndex) ? { ...d, status: 'reject', reason: 'estado cambio entre preview y execute' } : d
      ),
    });
  }

  return NextResponse.json({ error: 'mode debe ser preview, execute o expire' }, { status: 400 });
}
