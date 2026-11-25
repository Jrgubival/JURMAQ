"use client"

import { useEffect, useMemo, useState } from 'react';

interface Reglas {
  categoriasModo: 'todas' | 'incluir' | 'excluir';
  categoriasIds: number[];
  unUsoPorCliente: boolean;
  noAcumulable: boolean;
}

interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  monto_minimo_compra: number;
  max_usos_total: number | null;
  max_usos_por_usuario: number;
  usos_actuales: number;
  valido_desde: string | null;
  valido_hasta: string | null;
  activo: boolean;
  reglas: Reglas;
  usosPedidos: number;
  reservasVigentes: number;
}

interface Categoria {
  id: number;
  nombre: string;
  padre_id: number | null;
  activa: boolean | null;
}

const REGLAS_VACIAS: Reglas = { categoriasModo: 'todas', categoriasIds: [], unUsoPorCliente: false, noAcumulable: false };

interface Form {
  codigo: string;
  descripcion: string;
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  montoMinimoCompra: number;
  maxUsosTotal: string;
  maxUsosPorUsuario: number;
  validoHasta: string;
  reglas: Reglas;
}

const FORM_VACIO: Form = {
  codigo: '', descripcion: '', tipo: 'porcentaje', valor: 10, montoMinimoCompra: 0,
  maxUsosTotal: '', maxUsosPorUsuario: 1, validoHasta: '', reglas: REGLAS_VACIAS,
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

function resumenReglas(c: Cupon, nombres: Map<number, string>): string[] {
  const out: string[] = [];
  if (c.reglas.categoriasModo !== 'todas') {
    const lista = c.reglas.categoriasIds.map((id) => nombres.get(id) ?? `#${id}`).join(', ');
    out.push(`${c.reglas.categoriasModo === 'incluir' ? 'Solo' : 'Excepto'}: ${lista}`);
  }
  if (c.reglas.unUsoPorCliente) out.push('Un uso por cliente');
  if (c.reglas.noAcumulable) out.push('No se suma a ofertas');
  return out;
}

export default function CuponesAdminPage() {
  const [items, setItems] = useState<Cupon[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [interruptor, setInterruptor] = useState(false);
  const [gestionDisponible, setGestionDisponible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/cupones');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setCategorias(data.categorias || []);
      setInterruptor(!!data.interruptor);
      setGestionDisponible(data.gestionDisponible !== false);
    }
    setLoading(false);
  }

  const nombres = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  // Árbol simple: categorías principales y sus subcategorías debajo.
  const arbol = useMemo(() => {
    const raices = categorias.filter((c) => c.padre_id == null);
    const hijos = (id: number) => categorias.filter((c) => c.padre_id === id);
    return raices.flatMap((r) => [{ ...r, nivel: 0 }, ...hijos(r.id).map((h) => ({ ...h, nivel: 1 }))]);
  }, [categorias]);

  function empezarEdicion(c: Cupon) {
    setEditandoId(c.id);
    setForm({
      codigo: c.codigo,
      descripcion: c.descripcion ?? '',
      tipo: c.tipo,
      valor: Number(c.valor),
      montoMinimoCompra: Number(c.monto_minimo_compra) || 0,
      maxUsosTotal: c.max_usos_total ? String(c.max_usos_total) : '',
      maxUsosPorUsuario: c.max_usos_por_usuario,
      validoHasta: c.valido_hasta ? c.valido_hasta.slice(0, 10) : '',
      reglas: c.reglas,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  function setReglas(r: Partial<Reglas>) {
    setForm((f) => ({ ...f, reglas: { ...f.reglas, ...r } }));
  }

  function toggleCategoria(id: number) {
    const ya = form.reglas.categoriasIds.includes(id);
    setReglas({ categoriasIds: ya ? form.reglas.categoriasIds.filter((x) => x !== id) : [...form.reglas.categoriasIds, id] });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    try {
      const unUso = form.reglas.unUsoPorCliente;
      const reglas = {
        ...form.reglas,
        categoriasIds: form.reglas.categoriasModo === 'todas' ? [] : form.reglas.categoriasIds,
      };
      const cuerpo = {
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        valor: form.valor,
        montoMinimoCompra: form.montoMinimoCompra,
        // Con "un uso por cliente" no hay tope total.
        maxUsosTotal: unUso || !form.maxUsosTotal ? null : Number(form.maxUsosTotal),
        maxUsosPorUsuario: unUso ? 1 : form.maxUsosPorUsuario,
        validoHasta: form.validoHasta || null,
        reglas,
      };
      const res = await fetch(editandoId ? `/api/admin/cupones/${editandoId}` : '/api/admin/cupones', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editandoId ? cuerpo : { codigo: form.codigo, ...cuerpo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'No se pudo guardar' });
        return;
      }
      setMsg({ kind: 'ok', text: editandoId ? 'Cupón actualizado' : `Cupón ${data.cupon?.codigo ?? ''} creado` });
      cancelarEdicion();
      await load();
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  async function toggleActivo(c: Cupon) {
    const res = await fetch(`/api/admin/cupones/${c.id}`, c.activo
      ? { method: 'DELETE' }
      : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: true }) });
    if (res.ok) void load();
    else {
      const data = await res.json().catch(() => ({}));
      setMsg({ kind: 'err', text: data.error || 'No se pudo cambiar el estado' });
    }
  }

  const unUso = form.reglas.unUsoPorCliente;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cupones de descuento</h1>
        <p className="text-sm text-gray-500">
          Códigos de descuento para el checkout, con reglas por categoría, por cliente y de acumulación.
        </p>
      </div>

      {/* Estado del interruptor: solo se muestra; encenderlo requiere la aprobación de Jorge. */}
      <div
        className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
          interruptor ? 'bg-green-50 text-green-900 border-green-200' : 'bg-amber-50 text-amber-900 border-amber-200'
        }`}
      >
        <p className="font-semibold">
          Cupones en la tienda: {interruptor ? 'ENCENDIDOS' : 'APAGADOS'}
        </p>
        <p className="text-xs mt-0.5">
          {interruptor
            ? 'Los clientes ven el campo de cupón en el checkout y los cupones activos se aplican a los pedidos.'
            : 'Aunque un cupón esté activo, hoy no se aplica a ningún pedido ni se muestra en el checkout. Para encenderlos se necesita la aprobación de Jorge.'}
        </p>
      </div>

      {!gestionDisponible && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-800 border border-red-200">
          La base de gestión no responde: no se pueden ver las reglas ni los usos de los cupones, ni crear o editar con reglas. Los cupones no se aplican mientras tanto.
        </div>
      )}

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Form crear / editar */}
      <form onSubmit={guardar} className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {editandoId ? `Editar cupón ${form.codigo}` : '+ Nuevo cupón'}
          </h2>
          {editandoId && (
            <button type="button" onClick={cancelarEdicion} className="text-sm text-gray-600 hover:underline">
              Cancelar edición
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input
              type="text"
              required
              disabled={!!editandoId}
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              placeholder="BIENVENIDO20"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono uppercase disabled:bg-gray-100"
            />
            {editandoId && <p className="text-xs text-gray-500 mt-1">El código no se cambia (hay usos registrados).</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as 'porcentaje' | 'monto_fijo' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            >
              <option value="porcentaje">% Porcentaje</option>
              <option value="monto_fijo">$ Monto fijo CLP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor * ({form.tipo === 'porcentaje' ? '%' : 'CLP'})
            </label>
            <input
              type="number"
              required
              min={0}
              max={form.tipo === 'porcentaje' ? 100 : undefined}
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opc)</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Descuento bienvenida nuevos clientes"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compra mínima CLP</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.montoMinimoCompra}
              onChange={(e) => setForm({ ...form, montoMinimoCompra: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Se mide sobre los productos que califican.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tope total de usos (opc)</label>
            <input
              type="number"
              min={1}
              disabled={unUso}
              value={unUso ? '' : form.maxUsosTotal}
              onChange={(e) => setForm({ ...form, maxUsosTotal: e.target.value })}
              placeholder={unUso ? 'No se usa' : 'Ilimitado'}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vence (opc)</label>
            <input
              type="date"
              value={form.validoHasta}
              onChange={(e) => setForm({ ...form, validoHasta: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usos por cliente</label>
            <input
              type="number"
              min={0}
              disabled={unUso}
              value={unUso ? 1 : form.maxUsosPorUsuario}
              onChange={(e) => setForm({ ...form, maxUsosPorUsuario: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">0 = sin límite.</p>
          </div>
        </div>

        {/* Reglas */}
        <div className="border-t border-gray-100 pt-4 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Reglas del cupón</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categorías</label>
            <select
              value={form.reglas.categoriasModo}
              onChange={(e) => setReglas({ categoriasModo: e.target.value as Reglas['categoriasModo'] })}
              className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-xl text-sm"
            >
              <option value="todas">Todas las categorías</option>
              <option value="incluir">Solo estas categorías</option>
              <option value="excluir">Todas menos estas</option>
            </select>
            {form.reglas.categoriasModo !== 'todas' && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {arbol.map((c) => (
                  <label key={c.id} className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer ${c.nivel ? 'pl-5' : 'font-medium'}`}>
                    <input
                      type="checkbox"
                      checked={form.reglas.categoriasIds.includes(c.id)}
                      onChange={() => toggleCategoria(c.id)}
                      className="w-4 h-4 rounded accent-yellow-500"
                    />
                    {c.nombre}
                  </label>
                ))}
                {arbol.length === 0 && <p className="text-xs text-gray-500">No se pudieron cargar las categorías.</p>}
              </div>
            )}
            {form.reglas.categoriasModo !== 'todas' && (
              <p className="text-xs text-gray-500 mt-1">Al elegir una categoría principal entran también sus subcategorías.</p>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reglas.unUsoPorCliente}
              onChange={(e) => setReglas({ unUsoPorCliente: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded accent-yellow-500"
            />
            <span className="text-sm text-gray-700">
              <strong>Un uso por cliente</strong>, en vez de tope total
              <span className="block text-xs text-gray-500">
                Se controla por correo y por RUT (el cliente debe poner su RUT). Limitación: la tienda no tiene cuentas de cliente,
                así que quien use otro correo y otro RUT puede usar el cupón de nuevo.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reglas.noAcumulable}
              onChange={(e) => setReglas({ noAcumulable: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded accent-yellow-500"
            />
            <span className="text-sm text-gray-700">
              <strong>No acumulable con productos en oferta o precio web</strong>
              <span className="block text-xs text-gray-500">
                El cupón no se aplica a los productos que ya vienen con oferta (precio tachado), promoción de categoría o descuento por cantidad;
                el resto de la compra sí lo recibe. Solo se puede usar un cupón por pedido. El 2% por transferencia se mantiene.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={guardando || !form.codigo || form.valor <= 0 || (form.reglas.categoriasModo !== 'todas' && form.reglas.categoriasIds.length === 0)}
          className="px-5 py-2.5 bg-marca-600 hover:bg-marca-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear cupón'}
        </button>
      </form>

      {/* Lista */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin cupones creados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Descripción y reglas</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Valor</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Mín. compra</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Usos</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Vence</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.codigo}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    <div>{c.descripcion || '—'}</div>
                    {resumenReglas(c, nombres).map((r) => (
                      <span key={r} className="inline-block mt-1 mr-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : pesos(Number(c.valor))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{pesos(Number(c.monto_minimo_compra) || 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {c.usosPedidos + (c.usos_actuales || 0)}
                    {c.reglas.unUsoPorCliente ? '' : `/${c.max_usos_total ?? '∞'}`}
                    {c.reservasVigentes > 0 && <span className="block text-xs text-gray-500">{c.reservasVigentes} en curso</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.valido_hasta ? new Date(c.valido_hasta).toLocaleDateString('es-CL') : 'Sin vencimiento'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => empezarEdicion(c)} className="text-xs text-marca-600 hover:underline mr-3">
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(c)} className="text-xs text-marca-600 hover:underline">
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
