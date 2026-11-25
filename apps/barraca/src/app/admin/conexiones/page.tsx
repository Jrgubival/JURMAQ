import { requireRole } from "@jurmaq/shared/auth/guard";
import SinPermiso from "@/components/admin/SinPermiso";
import { listarLotes, obtenerGestionDb } from "@/lib/gestion";
import { listarConexiones, type Conexion } from "@/lib/mcp/oauth";
import { loteSePuedeDeshacer } from "@/lib/mcp/deshacer";
import { registro } from "@/lib/mcp/tools";
import AccionConexion from "./AccionesConexiones";

/**
 * /admin/conexiones — quién tiene conectado a Claude con la tienda y qué
 * cambió. Solo el administrador. Permite cortar una conexión al instante y
 * deshacer un cambio completo (cuando la herramienta que lo hizo sabe
 * deshacerse). Todo se lee de la base de gestión (D1).
 */
export const dynamic = "force-dynamic";

const FORMATO = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
const fecha = (ms: number | null) => (ms ? FORMATO.format(new Date(ms)) : "Nunca");

function hace(ms: number | null): string {
  if (!ms) return "Nunca";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "Hace un momento";
  if (s < 3600) return `Hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `Hace ${Math.round(s / 3600)} h`;
  return `Hace ${Math.round(s / 86400)} días`;
}

const NOMBRE_HERRAMIENTA = (n: string) => registro.obtener(n)?.titulo ?? n.replace(/_/g, " ");

export default async function ConexionesPage() {
  const session = await requireRole(["admin"]);
  if (!session) return <SinPermiso seccion="las conexiones" />;

  const db = await obtenerGestionDb();
  let conexiones: Conexion[] = [];
  let lotes: Array<Awaited<ReturnType<typeof listarLotes>>[number] & { sePuedeDeshacer: boolean }> = [];
  let noDisponible = !db;
  if (db) {
    try {
      conexiones = await listarConexiones(db);
      const base = await listarLotes(db, { limite: 25 });
      lotes = await Promise.all(base.map(async (l) => ({ ...l, sePuedeDeshacer: !l.deshecho && (await loteSePuedeDeshacer(db, registro, l.loteId)) })));
    } catch {
      noDisponible = true;
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="cifra text-[26px] font-semibold uppercase tracking-[0.04em] text-navy-950">Conexiones</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">
        Aquí ves quién tiene conectado a Claude con la tienda, puedes cortar el acceso al instante y deshacer cambios.
      </p>

      {noDisponible && (
        <p className="mb-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          La base de gestión todavía no está lista (falta crearla y aplicar las migraciones). Mientras tanto no hay conexiones ni historial.
        </p>
      )}

      <section aria-labelledby="t-conexiones" className="mb-10">
        <h2 id="t-conexiones" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-gray-500">Conexiones activas</h2>
        {conexiones.length === 0 ? (
          <p className="text-sm text-gray-600 bg-white border border-dashed border-gray-300 rounded-2xl p-4">
            No hay ninguna conexión activa. Para conectar a Claude, agrega la dirección del servidor en sus conectores y autoriza con tu cuenta.
          </p>
        ) : (
          <ul className="space-y-2">
            {conexiones.map((c) => (
              <li key={c.familiaId} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 break-words">{c.clienteNombre}</p>
                  <p className="text-sm text-gray-700 break-words">Usuario: {c.usuarioEmail ?? "sin correo"}</p>
                  <p className="text-sm text-gray-600">Conectada: {fecha(c.creadaEn)}</p>
                  <p className="text-sm text-gray-600">Último uso: {hace(c.ultimoUso)}</p>
                  <p className="text-xs text-gray-500">Permiso: {c.scope.includes("escribir") ? "ver y cambiar" : "solo ver"}</p>
                </div>
                <AccionConexion accion="revocar" id={c.familiaId} etiqueta="Revocar" confirmacion="Claude dejará de poder entrar a la tienda. Podrás volver a conectarlo cuando quieras." />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-historial">
        <h2 id="t-historial" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-gray-500">Historial de cambios</h2>
        {lotes.length === 0 ? (
          <p className="text-sm text-gray-600 bg-white border border-dashed border-gray-300 rounded-2xl p-4">Todavía no hay cambios registrados.</p>
        ) : (
          <ul className="space-y-2">
            {lotes.map((l) => (
              <li key={l.loteId} className={`bg-white border rounded-2xl p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${l.deshecho ? "border-dashed border-gray-300 opacity-75" : "border-gray-200"}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 break-words">{NOMBRE_HERRAMIENTA(l.herramienta)}</p>
                  <p className="text-sm text-gray-700">
                    {l.cambios} {l.cambios === 1 ? "cambio" : "cambios"} · {fecha(l.creadoEn)}
                  </p>
                  <p className="text-sm text-gray-600 break-words">Por {l.usuarioEmail ?? "usuario desconocido"}</p>
                  {l.deshecho && <p className="mt-1 text-xs font-bold text-gray-500">Deshecho</p>}
                  {!l.deshecho && !l.sePuedeDeshacer && <p className="mt-1 text-xs text-gray-500">Este cambio no se puede deshacer desde aquí.</p>}
                </div>
                {l.sePuedeDeshacer && (
                  <AccionConexion accion="deshacer" id={l.loteId} etiqueta="Deshacer" confirmacion={`Se van a devolver ${l.cambios === 1 ? "el cambio" : `los ${l.cambios} cambios`} a como estaban antes.`} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
