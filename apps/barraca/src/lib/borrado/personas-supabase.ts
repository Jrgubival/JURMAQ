import "server-only";
/**
 * Conexión real de `personas.ts` con Supabase (service role, solo servidor) y la D1 de gestión.
 * Todo filtro de correo usa `escapeLikePattern` (sin comodines). Una tabla que no existe en la base devuelve `null` al
 * contar (se informa) y no rompe la operación. Nunca `update(body)`: solo valores fijos de anonimización.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { escapeLikePattern } from "@jurmaq/shared/sanitize";
import type { D1Like } from "../gestion/tipos.ts";
import { ESTADOS_CERRADOS_SIN_PAGO, type PuertoPersonas } from "./personas.ts";

const db = supabaseAdmin as unknown as SupabaseClient;
const ANON = { nombre: "Anonimizado", telefono: "anonimizado" };

/** ¿El error de PostgREST es «la tabla no existe»? */
const sinTabla = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));
const emailAnon = (ref: string) => `anonimizado-${ref}@borrado.invalid`;

async function contar(tabla: string, col: string, email: string, extra?: (q: any) => any): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db.from(tabla).select("id", { count: "exact", head: true }).ilike(col, escapeLikePattern(email));
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) { if (sinTabla(error)) return null; throw error; }
  return count ?? 0;
}

export function crearPuertoPersonasReal(gestion: D1Like): PuertoPersonas {
  const porEnlotes = <T,>(xs: T[], n = 50) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  return {
    contarSuscriptores: (email) => contar("barraca_suscriptores", "email", email),
    async borrarSuscriptores(email) {
      const { data, error } = await db.from("barraca_suscriptores").delete().ilike("email", escapeLikePattern(email)).select("id");
      if (error) { if (sinTabla(error)) return 0; throw error; }
      return data?.length ?? 0;
    },
    contarCarritos: (email) => contar("barraca_carrito_abandonado", "email", email),
    async borrarCarritos(email) {
      const { data, error } = await db.from("barraca_carrito_abandonado").delete().ilike("email", escapeLikePattern(email)).select("id");
      if (error) { if (sinTabla(error)) return 0; throw error; }
      return data?.length ?? 0;
    },
    async cotizaciones(email) {
      const total = await contar("barraca_cotizaciones", "email", email);
      if (total === null) return null;
      const pagadas = (await contar("barraca_cotizaciones", "email", email, (q) => q.eq("estado", "pagada"))) ?? 0;
      return { total, pagadas };
    },
    async anonimizarCotizacionesNoPagadas(email) {
      const { data, error } = await db.from("barraca_cotizaciones")
        .update({ nombre: ANON.nombre, telefono: ANON.telefono, email: "anonimizado@borrado.invalid", empresa: null, rut: null, notas: null, accept_token: null, payment_url: null })
        .ilike("email", escapeLikePattern(email)).neq("estado", "pagada").select("id");
      if (error) { if (sinTabla(error)) return 0; throw error; }
      return data?.length ?? 0;
    },
    async pedidos(email) {
      const { data, error } = await db.from("barraca_pedidos").select("numero, estado, pagado_at, comprobante_path").ilike("email", escapeLikePattern(email)).limit(500);
      if (error) throw error;
      return (data ?? []).map((p: { numero: string; estado: string; pagado_at: string | null; comprobante_path: string | null }) => ({ numero: p.numero, estado: p.estado, pagado: !!p.pagado_at, comprobante_path: p.comprobante_path ?? null }));
    },
    async anonimizarPedidos(numeros) {
      let n = 0;
      for (const lote of porEnlotes(numeros)) {
        // Doble condición en la base: solo cerrados y NUNCA pagados (un pedido que se pagó en medio no se toca).
        const { data, error } = await db.from("barraca_pedidos")
          .update({
            nombre: ANON.nombre, telefono: ANON.telefono, email: "anonimizado@borrado.invalid", rut: null, direccion: null, notas: null,
            factura_razon_social: null, factura_rut: null, factura_giro: null, factura_direccion: null, comprobante_path: null, comprobante_nota: null,
          })
          .in("numero", lote).is("pagado_at", null).in("estado", ESTADOS_CERRADOS_SIN_PAGO).select("numero");
        if (error) throw error;
        n += data?.length ?? 0;
      }
      return n;
    },
    async contarOpiniones(numeros) {
      let n = 0;
      for (const lote of porEnlotes(numeros)) {
        const { count, error } = await db.from("barraca_reviews").select("id", { count: "exact", head: true }).in("pedido_numero", lote);
        if (error) { if (sinTabla(error)) return null; throw error; }
        n += count ?? 0;
      }
      return n;
    },
    async anonimizarOpiniones(numeros) {
      let n = 0;
      for (const lote of porEnlotes(numeros)) {
        const { data, error } = await db.from("barraca_reviews").update({ autor_publico: "Cliente", usuario_nombre: "Cliente" }).in("pedido_numero", lote).select("id");
        if (error) { if (sinTabla(error)) return 0; throw error; }
        n += data?.length ?? 0;
      }
      return n;
    },
    usuariosAntiguos: (email) => contar("barraca_usuarios", "email", email),
    async anonimizarUsuariosAntiguos(email) {
      const { data, error } = await db.from("barraca_usuarios").select("id").ilike("email", escapeLikePattern(email)).limit(20);
      if (error) { if (sinTabla(error)) return 0; throw error; }
      let n = 0;
      for (const u of (data ?? []) as Array<{ id: number }>) {
        const { error: e2 } = await db.from("barraca_usuarios").update({ nombre: ANON.nombre, email: emailAnon(String(u.id)), telefono: null, empresa: null, rut: null, activo: false }).eq("id", u.id);
        if (e2) throw e2;
        n++;
      }
      return n;
    },
    async borrarComprobante(ruta) {
      const m = await import("../pedidos/comprobantes");
      await m.borrarComprobante(ruta);
    },
    async borrarNotasInternas(numeros) {
      let n = 0;
      for (const lote of porEnlotes(numeros, 40)) {
        const r = await gestion.prepare(`DELETE FROM pedido_notas WHERE numero IN (${lote.map(() => "?").join(", ")})`).bind(...lote).run();
        n += r.meta?.changes ?? 0;
      }
      return n;
    },
    async contarNotasInternas(numeros) {
      let n = 0;
      for (const lote of porEnlotes(numeros, 40)) {
        const f = await gestion.prepare(`SELECT COUNT(*) AS n FROM pedido_notas WHERE numero IN (${lote.map(() => "?").join(", ")})`).bind(...lote).first<{ n: number }>();
        n += f?.n ?? 0;
      }
      return n;
    },
  };
}
