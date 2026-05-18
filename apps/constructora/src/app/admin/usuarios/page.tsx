'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type RoleId = 'admin' | 'gerente' | 'vendedor' | 'operador' | 'contador';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: RoleId;
  created_at?: string;
}

interface RoleOption {
  id: RoleId;
  label: string;
  description: string;
}

const roleBadge: Record<RoleId, string> = {
  admin: 'bg-red-100 text-red-700',
  gerente: 'bg-purple-100 text-purple-700',
  vendedor: 'bg-blue-100 text-blue-700',
  operador: 'bg-amber-100 text-amber-700',
  contador: 'bg-green-100 text-green-700',
};

const formatDate = (s?: string) => {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CL');
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'vendedor' as RoleId,
};

export default function UsuariosAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/usuarios');
      if (r.status === 403 || r.status === 401) {
        setForbidden(true);
        return;
      }
      if (!r.ok) {
        setError('Error al cargar usuarios');
        return;
      }
      const d = await r.json();
      setUsers(d.users || []);
      setRoles(d.roles || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const url = editing ? `/api/admin/usuarios/${editing.id}` : '/api/admin/usuarios';
      const method = editing ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || 'Error al guardar');
        return;
      }
      setShowModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    const r = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || 'Error al eliminar');
      return;
    }
    setConfirmDelete(null);
    fetchData();
  }

  if (forbidden) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Acceso denegado</h2>
        <p className="text-sm text-gray-600">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios del sistema</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} cuentas activas</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
          {error}
        </div>
      )}

      {/* Lista de roles */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">¿Qué puede hacer cada rol?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((r) => (
            <div key={r.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge[r.id] || 'bg-gray-100 text-gray-700'}`}>
                  {r.label}
                </span>
              </div>
              <p className="text-xs text-gray-600">{r.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-gray-200 px-4 py-3">
          <label htmlFor="usuarios-search" className="sr-only">
            Buscar usuario
          </label>
          <input
            id="usuarios-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-center">Creado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const q = search.trim().toLowerCase();
                const filtered = q
                  ? users.filter((u) =>
                      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                    )
                  : users;
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                        {q ? `Sin resultados para "${search}"` : 'No hay usuarios registrados'}
                      </td>
                    </tr>
                  );
                }
                return filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadge[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {roles.find((r) => r.id === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/admin/usuarios/${u.id}`}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
                          title="Ver detalle y documentos"
                        >
                          Detalle
                        </Link>
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        {confirmDelete === u.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="px-2 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-base text-gray-900"
                  placeholder="Juan Perez"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-base text-gray-900"
                  placeholder="trabajador@jurmaq.cl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {editing && <span className="text-xs text-gray-500 font-normal">(dejar vacío si no cambia)</span>}
                  {!editing && ' *'}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-base text-gray-900"
                  placeholder="Min 8 caracteres, 1 mayuscula, 1 numero"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as RoleId })}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-base text-gray-900 bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                {form.role && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {roles.find((r) => r.id === form.role)?.description}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.email || (!editing && !form.password)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0c1d3a' }}
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
