"use client";

import { useEffect, useState } from "react";

/**
 * /admin/despacho — tarifas del camión por zona: cuánto se cobra y desde qué
 * monto de productos el despacho es gratis. Guarda en barraca_zonas_despacho
 * (API /api/admin/despacho). Si la tabla todavía no existe, muestra las
 * tarifas del código en modo sólo lectura.
 */

interface Zona {
  id: string;
  nombre: string;
  comuna: string;
  costo: number;
  gratis_desde: number | null;
  activo: boolean;
  orden: number;
}

interface Borrador { costo: string; gratis: string; activo: boolean }

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const soloDigitos = (s: string) => s.replace(/\D/g, "").slice(0, 8);

export default function DespachoAdminPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [editable, setEditable] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>({ costo: "", gratis: "", activo: true });
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/despacho", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setZonas(data.zonas || []); setEditable(!!data.editable); }
      else setError(data.error || "No se pudieron cargar las tarifas");
    } catch {
      setError("Sin conexión. Revisa el internet y vuelve a intentar.");
    }
    setCargando(false);
  }

  useEffect(() => { void cargar(); }, []);

  function abrir(z: Zona) {
    setOk(null);
    setEditando(z.id);
    setBorrador({ costo: String(z.costo), gratis: z.gratis_desde != null ? String(z.gratis_desde) : "", activo: z.activo });
  }

  async function guardar(z: Zona) {
    const costo = Number(borrador.costo);
    const gratis = borrador.gratis === "" ? null : Number(borrador.gratis);
    if (borrador.costo === "" || !Number.isInteger(costo) || costo < 0) { alert("Escribe el costo en pesos, sin puntos (0 o más)."); return; }
    if (gratis != null && (!Number.isInteger(gratis) || gratis < 1)) { alert("\"Gratis desde\" debe ser un monto en pesos, o dejarlo vacío."); return; }
    if (costo === 0 && !confirm(`¿Despacho gratis siempre a ${z.nombre}? (costo $0)`)) return;
    if (!borrador.activo && z.activo && !confirm(`¿Dejar de ofrecer despacho a ${z.nombre}?`)) return;
    setGuardando(true);
    const res = await fetch("/api/admin/despacho", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: z.id, costo, gratis_desde: gratis, activo: borrador.activo }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(false);
    if (!res?.ok) { alert(data.error || "No se pudo guardar"); return; }
    setZonas((l) => l.map((x) => (x.id === z.id ? data.zona : x)));
    setEditando(null);
    setOk(`Guardado: ${z.nombre}. La página lo toma en un minuto.`);
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Lo que se cobra por llevar un pedido en el camión. Si el pedido supera &quot;Gratis desde&quot;, el despacho no se cobra.
      </p>
      {!cargando && !editable && !error && (
        <p className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Estas son las tarifas fijas de la página. Para editarlas aquí falta crear la tabla de tarifas en la base (migración pendiente).
        </p>
      )}
      {ok && <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{ok}</p>}
      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <ul className="space-y-2">
          {zonas.map((z) => (
            <li key={z.id} className={`bg-white border rounded-2xl p-3 ${z.activo ? "border-gray-200" : "border-dashed border-gray-300 opacity-75"}`}>
              {editando !== z.id ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{z.nombre}{!z.activo && <span className="ml-2 text-xs font-bold text-gray-500">(sin despacho)</span>}</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-bold tabular-nums">{z.costo === 0 ? "Gratis" : fmt(z.costo)}</span>
                      <span className="text-gray-500"> · {z.gratis_desde != null ? `gratis desde ${fmt(z.gratis_desde)}` : "nunca gratis"}</span>
                    </p>
                  </div>
                  {editable && (
                    <button onClick={() => abrir(z)} className="min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-gray-300 text-gray-800 shrink-0">
                      Editar
                    </button>
                  )}
                </div>
              ) : (
                <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void guardar(z); }}>
                  <p className="font-semibold text-gray-900">{z.nombre}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">Costo ($)
                      <input inputMode="numeric" pattern="[0-9]*" value={borrador.costo} onChange={(e) => setBorrador({ ...borrador, costo: soloDigitos(e.target.value) })} className="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-gray-300 text-base text-gray-900" />
                    </label>
                    <label className="text-xs text-gray-600">Gratis desde ($)
                      <input inputMode="numeric" pattern="[0-9]*" placeholder="Nunca" value={borrador.gratis} onChange={(e) => setBorrador({ ...borrador, gratis: soloDigitos(e.target.value) })} className="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-gray-300 text-base text-gray-900" />
                    </label>
                  </div>
                  <label className="flex items-center gap-3 min-h-[44px] text-sm text-gray-800">
                    <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} className="w-5 h-5" />
                    Despachamos a {z.nombre}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditando(null)} className="min-h-[44px] rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Cancelar</button>
                    <button type="submit" disabled={guardando} className="min-h-[44px] rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-60">{guardando ? "Guardando…" : "Guardar"}</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
