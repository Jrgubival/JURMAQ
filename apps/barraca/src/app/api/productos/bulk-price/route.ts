import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function PUT(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('barraca_precios', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    // Bulk price update can rewrite hundreds of rows; cap to 5/min/IP so a
    // mis-typed multiplier or a runaway script can't churn the DB.
    const ip = getClientIp(request);
    const limiter = rateLimit(`bulk-price:${ip}`, { maxAttempts: 5, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json({ error: 'Demasiadas operaciones masivas. Espera un minuto.' }, { status: 429 });
    }

    const body = await request.json();
    const { action } = body;

    // --- Ajuste de precios por porcentaje (categoria) ---
    if (action === 'percentage') {
      const { categoriaId, percentage } = body;
      if (!categoriaId || percentage === undefined) {
        return NextResponse.json({ error: 'categoriaId y percentage son requeridos' }, { status: 400 });
      }

      const { data: productos, error: fetchError } = await supabaseAdmin
        .from('barraca_productos')
        .select('id, precio')
        .eq('categoria_id', categoriaId);

      if (fetchError) throw fetchError;
      if (!productos || productos.length === 0) {
        return NextResponse.json({ error: 'No se encontraron productos en esta categoria' }, { status: 404 });
      }

      const updates = productos.map((p) => ({
        id: p.id,
        precio: Math.round(p.precio * (1 + percentage / 100)),
      }));

      // Parallel updates instead of sequential — each UPDATE has a different
      // target price, so we can't collapse to a single SQL statement, but we
      // can fire them concurrently. For a 100-row batch this drops latency
      // from ~10s to <1s.
      const results = await Promise.all(
        updates.map((u) =>
          supabaseAdmin
            .from('barraca_productos')
            .update({ precio: u.precio })
            .eq('id', u.id)
        )
      );
      const updatedCount = results.filter((r) => !r.error).length;

      return NextResponse.json({
        updated: updatedCount,
        productos: updates.slice(0, 5),
      });
    }

    // --- Ajuste de precios por peso (valor/kg) ---
    if (action === 'by_weight') {
      const { categoriaId, valorKg } = body;
      if (!valorKg) {
        return NextResponse.json({ error: 'valorKg es requerido' }, { status: 400 });
      }

      let catId = categoriaId;
      if (!catId) {
        const { data: cat } = await supabaseAdmin
          .from('barraca_categorias')
          .select('id')
          .ilike('nombre', '%fierro%construc%')
          .single();
        if (cat) catId = cat.id;
      }

      if (!catId) {
        return NextResponse.json({ error: 'No se encontro la categoria de fierros' }, { status: 404 });
      }

      const { data: productos, error: fetchError } = await supabaseAdmin
        .from('barraca_productos')
        .select('id, nombre, peso, precio')
        .eq('categoria_id', catId)
        .gt('peso', 0);

      if (fetchError) throw fetchError;
      if (!productos || productos.length === 0) {
        return NextResponse.json({ error: 'No se encontraron productos con peso en esta categoria' }, { status: 404 });
      }

      const updates = productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        peso: p.peso,
        precioAnterior: p.precio,
        precio: Math.round((p.peso || 0) * valorKg),
      }));

      const results = await Promise.all(
        updates.map((u) =>
          supabaseAdmin
            .from('barraca_productos')
            .update({ precio: u.precio })
            .eq('id', u.id)
        )
      );
      const updatedCount = results.filter((r) => !r.error).length;

      return NextResponse.json({
        updated: updatedCount,
        productos: updates,
      });
    }

    // --- DESHABILITADAS POR CUMPLIMIENTO Ley 19.496 art. 28 ---
    // Las acciones `create_offers` y `preview_offers` inflaban el precio_actual y
    // guardaban el real en precio_original, simulando un descuento que nunca existió.
    // Eso es publicidad engañosa segun el SERNAC: el precio anterior tachado debe ser
    // un precio que estuvo efectivamente vigente durante los 30 dias previos.
    // Para crear una oferta legitima, usar la accion `set_offer` que solo permite
    // BAJAR el precio actual (snapshot del precio vigente queda en precio_original).
    if (action === 'create_offers' || action === 'preview_offers') {
      return NextResponse.json(
        {
          error: 'Accion deshabilitada por cumplimiento Ley 19.496 art. 28 (SERNAC). ' +
                 'Para crear ofertas legitimas usa action="set_offer" con un precio promocional menor al actual.',
        },
        { status: 410 }
      );
    }

    // --- CREAR OFERTA LEGITIMA: bajar precio, snapshot del actual como precio_original ---
    // El admin envia el precio promocional (menor que el actual). El sistema guarda el
    // precio actualmente vigente como precio_original (precio anterior tachado en UI),
    // que se vuelve la referencia historica del "precio antes de la oferta".
    if (action === 'set_offer') {
      const { productoId, precioPromocional } = body;
      if (!productoId || typeof productoId !== 'number') {
        return NextResponse.json({ error: 'productoId es requerido' }, { status: 400 });
      }
      if (!precioPromocional || typeof precioPromocional !== 'number' || precioPromocional <= 0) {
        return NextResponse.json({ error: 'precioPromocional es requerido y debe ser mayor a 0' }, { status: 400 });
      }

      const { data: producto, error: fetchError } = await supabaseAdmin
        .from('barraca_productos')
        .select('id, codigo, nombre, precio, en_oferta')
        .eq('id', productoId)
        .single();

      if (fetchError || !producto) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
      if (producto.en_oferta) {
        return NextResponse.json({ error: 'El producto ya esta en oferta. Desactiva la oferta vigente antes de crear una nueva.' }, { status: 409 });
      }
      if (precioPromocional >= producto.precio) {
        return NextResponse.json(
          {
            error: 'El precio promocional debe ser MENOR al precio actual. ' +
                   'No esta permitido inflar el precio para simular descuento (Ley 19.496 art. 28).',
            precioActual: producto.precio,
            precioPromocional,
          },
          { status: 422 }
        );
      }

      // --- Validacion 30 dias (Ley 19.496 art. 28) ---
      // El precio actual (que sera el "precio_original" tachado para el cliente) debe
      // haber estado efectivamente vigente al menos 30 dias acumulados en los ultimos
      // 30 dias. Sin historial suficiente, la oferta no puede activarse.
      const VENTANA_DIAS = 30;
      const MIN_DIAS_VIGENCIA = 30;
      const allowSkip = body.skipHistorialCheck === true; // solo para overrides explicitos
      if (!allowSkip) {
        const { data: diasVigente, error: rpcError } = await supabaseAdmin.rpc(
          'precio_vigente_acumulado_dias',
          { p_producto_id: productoId, p_precio: producto.precio, p_ventana_dias: VENTANA_DIAS }
        );
        if (rpcError) {
          // PostgREST PGRST202 = funcion no existe en el schema cache.
          // Esto pasa hasta que se ejecute scripts/migrate-precio-historial.sql.
          if (rpcError.code === 'PGRST202' || /precio_vigente_acumulado_dias/.test(rpcError.message)) {
            return NextResponse.json(
              {
                error: 'Falta migracion: ejecuta scripts/migrate-precio-historial.sql en Supabase ' +
                       'antes de crear ofertas. Sin esa tabla no podemos demostrar que el precio ' +
                       'tachado estuvo vigente 30 dias (requerido por Ley 19.496 art. 28).',
              },
              { status: 503 }
            );
          }
          throw rpcError;
        }
        const diasNum = Number(diasVigente ?? 0);
        if (diasNum < MIN_DIAS_VIGENCIA) {
          return NextResponse.json(
            {
              error: `El precio actual (${producto.precio}) solo estuvo vigente ${diasNum} de los ` +
                     `ultimos ${VENTANA_DIAS} dias. Para activar oferta legitima debe haber estado ` +
                     `vigente al menos ${MIN_DIAS_VIGENCIA} dias (Ley 19.496 art. 28 SERNAC).`,
              diasVigencia: diasNum,
              diasRequeridos: MIN_DIAS_VIGENCIA,
            },
            { status: 422 }
          );
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('barraca_productos')
        .update({
          precio_original: producto.precio,
          precio: precioPromocional,
          en_oferta: true,
        })
        .eq('id', productoId)
        .eq('en_oferta', false); // anti race-condition: solo si sigue sin oferta

      if (updateError) throw updateError;

      return NextResponse.json({
        ok: true,
        producto: {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          precioOriginal: producto.precio,
          precioPromocional,
          descuento: Math.round((1 - precioPromocional / producto.precio) * 100),
        },
      });
    }

    // --- DESACTIVAR PROMOCION (restaurar precios originales) ---
    if (action === 'remove_offers') {
      const { categoriaId, codigoPrefix } = body;
      if (!categoriaId && !codigoPrefix) {
        return NextResponse.json({ error: 'Se requiere categoriaId o codigoPrefix' }, { status: 400 });
      }

      let query = supabaseAdmin
        .from('barraca_productos')
        .select('id, codigo, nombre, precio, precio_original')
        .eq('en_oferta', true);

      if (codigoPrefix) {
        query = query.ilike('codigo', `${codigoPrefix}%`);
      } else if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
      }

      const { data: productos, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!productos || productos.length === 0) {
        return NextResponse.json({ updated: 0, productos: [] });
      }

      const planned = productos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        precioAnteriorInflado: p.precio,
        precioRestaurado: p.precio_original || p.precio,
      }));

      const restoreResults = await Promise.all(
        planned.map((p) =>
          supabaseAdmin
            .from('barraca_productos')
            .update({
              precio: p.precioRestaurado,
              en_oferta: false,
              precio_original: null,
            })
            .eq('id', p.id)
        )
      );
      const resultados = planned.filter((_, i) => !restoreResults[i].error);

      return NextResponse.json({
        updated: resultados.length,
        productos: resultados,
      });
    }

    // --- LISTAR PRODUCTOS EN OFERTA ---
    if (action === 'list_offers') {
      const { categoriaId, codigoPrefix } = body;

      let query = supabaseAdmin
        .from('barraca_productos')
        .select('id, codigo, nombre, precio, precio_original, en_oferta, categoria_id')
        .eq('en_oferta', true)
        .eq('activo', true);

      if (codigoPrefix) {
        query = query.ilike('codigo', `${codigoPrefix}%`);
      } else if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
      }

      const { data: productos, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const result = (productos || []).map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        precioInflado: p.precio,
        precioReal: p.precio_original,
        descuentoVisible: p.precio_original
          ? Math.round((1 - p.precio_original / p.precio) * 100)
          : 0,
      }));

      return NextResponse.json({ productos: result });
    }

    // --- Toggle solo_cotizar ---
    if (action === 'toggle_cotizar') {
      const { categoriaId, soloCotizar } = body;
      if (!categoriaId || soloCotizar === undefined) {
        return NextResponse.json({ error: 'categoriaId y soloCotizar son requeridos' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('barraca_productos')
        .update({ solo_cotizar: soloCotizar })
        .eq('categoria_id', categoriaId)
        .select('id');

      if (error) throw error;

      return NextResponse.json({ updated: data?.length || 0 });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
  } catch (error) {
    console.error('Error en bulk-price:', error);
    return NextResponse.json(
      { error: 'Error al actualizar precios' },
      { status: 500 }
    );
  }
}
