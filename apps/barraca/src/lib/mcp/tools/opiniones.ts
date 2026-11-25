/**
 * Herramientas de OPINIONES de productos (tabla barraca_reviews de Supabase,
 * comprobada: existe). Solo listar y moderar (ocultar / volver a mostrar).
 * No se borran opiniones ni se escriben nuevas: ocultar = estado «rechazada»
 * (la tienda solo muestra las «aprobada»), y se puede volver atrás.
 *
 * Lo que escribe el cliente (título y comentario) se entrega SIEMPRE como dato
 * entre marcadores, nunca como instrucción.
 */
import { defineHerramienta, ErrorHerramienta, z, type Herramienta, type Revertidor } from "./registro.ts";
import { historialDeEntidad } from "../../gestion/auditoria.ts";
import { AVISO_DATO_DE_CLIENTE, aEnteroSeguro, datoDeCliente, recortar } from "./contenido-comun.ts";

export type EstadoOpinion = "pendiente" | "aprobada" | "rechazada";

export interface FilaOpinion {
  id: string;
  producto_id: number;
  producto_codigo: string | null;
  producto_nombre: string | null;
  rating: number;
  titulo: string | null;
  comentario: string | null;
  estado: EstadoOpinion;
  autor_publico: string | null;
  compra_verificada: boolean;
  created_at: string;
}

export interface DepsOpiniones {
  listar(f: { estado?: EstadoOpinion; productoIds?: number[]; limite: number; antesDe?: string }): Promise<FilaOpinion[]>;
  porIds(ids: string[]): Promise<FilaOpinion[]>;
  /** Cambia el estado. Devuelve cuántas filas cambió. */
  cambiarEstado(ids: string[], estado: EstadoOpinion): Promise<number>;
  productoIdsPorCodigo(codigo: string): Promise<number[]>;
  revalidarFichas(productoIds: number[]): Promise<void>;
}

const COLUMNAS = "id, producto_id, rating, titulo, comentario, estado, autor_publico, compra_verificada, created_at, barraca_productos:producto_id ( codigo, nombre )";

export function depsOpinionesReales(): DepsOpiniones {
  type Cliente = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const db = async () => ((await import("@jurmaq/shared/supabase")).supabaseAdmin as unknown as Cliente);
  const aFila = (r: Record<string, unknown>): FilaOpinion => {
    const p = (r.barraca_productos ?? null) as { codigo?: string; nombre?: string } | null;
    return {
      id: String(r.id), producto_id: Number(r.producto_id), producto_codigo: p?.codigo ?? null, producto_nombre: p?.nombre ?? null,
      rating: Number(r.rating), titulo: (r.titulo as string | null) ?? null, comentario: (r.comentario as string | null) ?? null,
      estado: r.estado as EstadoOpinion, autor_publico: (r.autor_publico as string | null) ?? null,
      compra_verificada: Boolean(r.compra_verificada), created_at: String(r.created_at),
    };
  };
  return {
    async listar(f) {
      let q = (await db()).from("barraca_reviews").select(COLUMNAS).order("created_at", { ascending: false }).limit(f.limite);
      if (f.estado) q = q.eq("estado", f.estado);
      if (f.productoIds?.length) q = q.in("producto_id", f.productoIds);
      if (f.antesDe) q = q.lt("created_at", f.antesDe);
      const { data, error } = await q;
      if (error) throw new Error("opiniones");
      return ((data ?? []) as Record<string, unknown>[]).map(aFila);
    },
    async porIds(ids) {
      const { data, error } = await (await db()).from("barraca_reviews").select(COLUMNAS).in("id", ids);
      if (error) throw new Error("opiniones");
      return ((data ?? []) as Record<string, unknown>[]).map(aFila);
    },
    async cambiarEstado(ids, estado) {
      const { data, error } = await (await db()).from("barraca_reviews").update({ estado, moderado_at: new Date().toISOString() }).in("id", ids).select("id");
      if (error) throw new Error("opiniones");
      return (data ?? []).length;
    },
    async productoIdsPorCodigo(codigo) {
      const { data, error } = await (await db()).from("barraca_productos").select("id").eq("codigo", codigo).limit(20);
      if (error) throw new Error("opiniones");
      return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
    },
    async revalidarFichas(ids) {
      try {
        const m = await import("../../revalidar.ts");
        await m.revalidarFichas(ids);
      } catch {
        /* la ficha se regenera sola con el tiempo */
      }
    },
  };
}

const ETIQUETA_ESTADO: Record<EstadoOpinion, string> = { aprobada: "visible", rechazada: "oculta", pendiente: "pendiente" };
const FILTRO: Record<"visibles" | "ocultas" | "pendientes", EstadoOpinion> = { visibles: "aprobada", ocultas: "rechazada", pendientes: "pendiente" };

function lineaOpinion(o: FilaOpinion): string {
  const cabecera = `- ${o.id} · ${"★".repeat(o.rating)}${"☆".repeat(5 - o.rating)} · ${ETIQUETA_ESTADO[o.estado]} · ${o.producto_codigo ?? `producto ${o.producto_id}`} ${recortar(o.producto_nombre ?? "", 60)} · ${o.autor_publico ?? "cliente"}${o.compra_verificada ? " (compra verificada)" : ""} · ${o.created_at.slice(0, 10)}`;
  const textos = [o.titulo, o.comentario].filter(Boolean).join("\n");
  return textos ? `${cabecera}\n${datoDeCliente(textos, 500)}` : cabecera;
}

export function crearHerramientasOpiniones(depsInyectadas?: Partial<DepsOpiniones>): Herramienta[] {
  const deps = (): DepsOpiniones => ({ ...depsOpinionesReales(), ...depsInyectadas });

  const listar_opiniones = defineHerramienta({
    nombre: "listar_opiniones",
    titulo: "Listar opiniones de productos",
    descripcion: `Lista opiniones que dejaron los clientes (las más nuevas primero): estrellas, producto, autor público y su texto. ${AVISO_DATO_DE_CLIENTE} Filtra por estado (visibles, ocultas, pendientes) o por código de producto. Pagina con «antes_de» (la fecha de la última que recibiste).`,
    esquema: z.object({
      estado: z.enum(["visibles", "ocultas", "pendientes"]).optional(),
      producto_codigo: z.string().trim().min(1).max(60).optional(),
      limite: z.number().int().min(1).max(30).optional(),
      antes_de: z.string().max(40).optional().describe("Fecha ISO de creación: trae solo las anteriores."),
    }),
    anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ejecutar({ estado, producto_codigo, limite, antes_de }) {
      let productoIds: number[] | undefined;
      if (producto_codigo) {
        productoIds = await deps().productoIdsPorCodigo(producto_codigo);
        if (productoIds.length === 0) throw new ErrorHerramienta(`No existe un producto con el código ${producto_codigo}.`);
      }
      if (antes_de !== undefined && Number.isNaN(Date.parse(antes_de))) throw new ErrorHerramienta("«antes_de» no es una fecha válida.");
      const lim = aEnteroSeguro(limite, 15, 1, 30);
      const filas = await deps().listar({ estado: estado ? FILTRO[estado] : undefined, productoIds, limite: lim, antesDe: antes_de });
      if (filas.length === 0) return { texto: "No hay opiniones con ese filtro todavía.", datos: { total: 0 } };
      const siguiente = filas.length === lim ? filas[filas.length - 1].created_at : null;
      return {
        texto: `${AVISO_DATO_DE_CLIENTE}\n${filas.map(lineaOpinion).join("\n")}${siguiente ? `\nHay más: pide con antes_de ${siguiente}.` : ""}`,
        datos: { total: filas.length, siguienteAntesDe: siguiente, ids: filas.map((f) => f.id) },
      };
    },
  });

  const revertir: Revertidor = async ({ entradas }) => {
    const ids = entradas.map((e) => e.entidadId);
    const actuales = (await deps().porIds(ids)).map((o) => ({ id: o.id, estado: o.estado, producto_id: o.producto_id }));
    const mapa = new Map(actuales.map((o) => [o.id, o]));
    const porEstado = new Map<EstadoOpinion, string[]>();
    for (const e of entradas) {
      const antes = (e.antes ?? {}) as { estado?: EstadoOpinion };
      const despues = (e.despues ?? {}) as { estado?: EstadoOpinion };
      const o = mapa.get(e.entidadId);
      if (!o || !antes.estado) return { ok: false, mensaje: "No encontré una de las opiniones." };
      if (o.estado !== despues.estado) return { ok: false, mensaje: "Una opinión cambió de estado después; no la piso. Revísala antes de deshacer." };
      porEstado.set(antes.estado, [...(porEstado.get(antes.estado) ?? []), o.id]);
    }
    for (const [estado, lista] of porEstado) await deps().cambiarEstado(lista, estado);
    await deps().revalidarFichas([...new Set(actuales.map((o) => o.producto_id))]);
    return { ok: true, mensaje: `${entradas.length} opinión(es) vuelta(s) a como estaban.` };
  };

  const moderar_opinion = defineHerramienta({
    nombre: "moderar_opinion",
    titulo: "Ocultar o volver a mostrar opiniones",
    descripcion: "Oculta (acción «ocultar») o vuelve a mostrar (acción «mostrar») hasta 20 opiniones por su id (de listar_opiniones). «Mostrar» solo sirve para opiniones que estaban visibles y se ocultaron desde aquí: nunca publica opiniones pendientes de revisión. Ocultar no borra la opinión: solo deja de verse en la ficha del producto, y se puede deshacer. No se pueden editar ni borrar opiniones. Muéstrale al usuario cuáles vas a tocar y pide su OK.",
    esquema: z.object({ ids: z.array(z.string().uuid()).min(1).max(20), accion: z.enum(["ocultar", "mostrar"]) }),
    anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ejecutar({ ids, accion }, ctx) {
      const unicos = [...new Set(ids)];
      const nuevo: EstadoOpinion = accion === "ocultar" ? "rechazada" : "aprobada";
      const filas = await deps().porIds(unicos);
      const faltan = unicos.filter((id) => !filas.some((f) => f.id === id));
      if (faltan.length) throw new ErrorHerramienta(`No encontré estas opiniones: ${faltan.join(", ")}. No cambié nada.`);
      if (accion === "mostrar") {
        // «Mostrar» solo devuelve lo que esta herramienta ocultó y ya estaba aprobado por el flujo normal.
        // Una opinión pendiente (o rechazada en el panel) NO se publica desde aquí: se revisa y aprueba en el panel.
        const noAptas: string[] = [];
        for (const f of filas) {
          if (f.estado === "aprobada") continue;
          if (f.estado === "pendiente") { noAptas.push(f.id); continue; }
          const hist = await historialDeEntidad(ctx.db, "opinion", f.id, 20);
          const ocultada = hist.find((h) => h.deshechoEn === null && (h.antes as { estado?: string } | null)?.estado === "aprobada" && (h.despues as { estado?: string } | null)?.estado === "rechazada");
          if (!ocultada) noAptas.push(f.id);
        }
        if (noAptas.length) {
          throw new ErrorHerramienta(`No puedo mostrar estas opiniones: ${noAptas.join(", ")}. Solo se vuelve a mostrar lo que antes estaba visible y se ocultó desde aquí; las pendientes de revisión (o rechazadas en el panel) se aprueban en el panel de administración. No cambié nada.`);
        }
      }
      const cambian = filas.filter((f) => f.estado !== nuevo);
      if (cambian.length === 0) return `Esas opiniones ya estaban ${accion === "ocultar" ? "ocultas" : "visibles"}.`;
      const previas = cambian.map((f) => ({ id: f.id, productoId: f.producto_id, estado: f.estado }));
      const n = await deps().cambiarEstado(previas.map((f) => f.id), nuevo);
      await ctx.auditar(previas.map((f) => ({ entidad: "opinion", entidadId: f.id, antes: { estado: f.estado }, despues: { estado: nuevo } })));
      await deps().revalidarFichas([...new Set(previas.map((f) => f.productoId))]);
      return { texto: `${n} opinión(es) ${accion === "ocultar" ? "ocultada(s)" : "visible(s) otra vez"}. Las fichas se actualizan en unos minutos. Se puede deshacer.`, datos: { cambiadas: n } };
    },
    revertidor: revertir,
  });

  return [listar_opiniones, moderar_opinion] as unknown as Herramienta[];
}
