"use client"

import { useState } from 'react';

interface Perfil {
  id: number;
  email: string | null;
  nombre: string | null;
  rut: string | null;
  empresa: string | null;
  telefono: string | null;
  direccion: string | null;
}

export default function PerfilClient({ perfil }: { perfil: Perfil }) {
  const [form, setForm] = useState({
    nombre: perfil.nombre ?? '',
    telefono: perfil.telefono ?? '',
    rut: perfil.rut ?? '',
    empresa: perfil.empresa ?? '',
    direccion: perfil.direccion ?? '',
  });
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (showPwd) {
      if (pwdForm.next !== pwdForm.confirm) {
        setMsg({ kind: 'err', text: 'Las contraseñas no coinciden' });
        setLoading(false);
        return;
      }
      if (pwdForm.next && pwdForm.next.length < 8) {
        setMsg({ kind: 'err', text: 'La nueva contraseña debe tener al menos 8 caracteres' });
        setLoading(false);
        return;
      }
    }

    const body: Record<string, string> = { ...form };
    if (showPwd && pwdForm.next) {
      body.current_password = pwdForm.current;
      body.new_password = pwdForm.next;
    }

    try {
      const res = await fetch('/api/cuenta/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error al guardar' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Perfil actualizado correctamente' });
      if (showPwd) {
        setPwdForm({ current: '', next: '', confirm: '' });
        setShowPwd(false);
      }
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza tus datos personales y contraseña.</p>
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={save} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            disabled
            value={perfil.email ?? ''}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar desde acá. Escríbenos si lo necesitas.</p>
        </div>

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo *
          </label>
          <input
            id="nombre"
            type="text"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              id="telefono"
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
              placeholder="+569..."
            />
          </div>
          <div>
            <label htmlFor="rut" className="block text-sm font-medium text-gray-700 mb-1">
              RUT
            </label>
            <input
              id="rut"
              type="text"
              value={form.rut}
              onChange={(e) => setForm({ ...form, rut: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
              placeholder="12345678-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="empresa" className="block text-sm font-medium text-gray-700 mb-1">
            Empresa
          </label>
          <input
            id="empresa"
            type="text"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>

        <div>
          <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
            Dirección de facturación
          </label>
          <input
            id="direccion"
            type="text"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>

        <div className="pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="text-sm text-orange-600 hover:underline font-medium"
          >
            {showPwd ? '− Ocultar cambio de contraseña' : '+ Cambiar contraseña'}
          </button>

          {showPwd && (
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="cur-pwd" className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña actual
                </label>
                <input
                  id="cur-pwd"
                  type="password"
                  value={pwdForm.current}
                  onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-pwd" className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva contraseña
                  </label>
                  <input
                    id="new-pwd"
                    type="password"
                    minLength={8}
                    value={pwdForm.next}
                    onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-pwd" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirma
                  </label>
                  <input
                    id="confirm-pwd"
                    type="password"
                    minLength={8}
                    value={pwdForm.confirm}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
