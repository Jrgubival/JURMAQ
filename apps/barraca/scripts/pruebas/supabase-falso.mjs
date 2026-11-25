// Supabase falso para pruebas con node --test. NUNCA toca la base real.
// Las pruebas cargan datos en globalThis.__PRODUCTOS_FALSOS__ y leen las
// escrituras en globalThis.__ESCRITURAS_FALSAS__.
globalThis.__PRODUCTOS_FALSOS__ ??= [];
globalThis.__ESCRITURAS_FALSAS__ ??= [];

function consulta(tabla) {
  const estado = { accion: "select", desde: 0, hasta: 999, valores: null, filtroId: null };
  const api = {
    select() { return api; },
    order() { return api; },
    range(desde, hasta) { estado.desde = desde; estado.hasta = hasta; return api; },
    update(valores) { estado.accion = "update"; estado.valores = valores; return api; },
    insert(valores) { estado.accion = "insert"; estado.valores = valores; return api; },
    eq(_col, valor) { estado.filtroId = valor; return api; },
    then(resolver, rechazar) {
      let resultado;
      if (estado.accion === "select" && globalThis.__FALLA_SELECT__) {
        resultado = { data: null, error: { message: "falla simulada" } };
      } else if (estado.accion === "select") {
        const filas = globalThis.__PRODUCTOS_FALSOS__.slice(estado.desde, estado.hasta + 1);
        resultado = { data: filas, error: null };
      } else {
        globalThis.__ESCRITURAS_FALSAS__.push({ tabla, accion: estado.accion, id: estado.filtroId, valores: estado.valores });
        resultado = { data: null, error: null };
      }
      return Promise.resolve(resultado).then(resolver, rechazar);
    },
  };
  return api;
}

export const supabaseAdmin = { from: consulta };
