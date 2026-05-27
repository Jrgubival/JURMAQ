"use client"

import { useEffect, useState } from 'react';

export default function ResetClient() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg({ kind: 'err', text: 'Las contraseñas no coinciden' });
      return;
    }
    if (password.length < 8) {
      setMsg({ kind: 'err', text: 'Mínimo 8 caracteres' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cuenta/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', reset_token: token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error al restablecer' });
        return;
      }
      window.location.href = '/cuenta';
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configura tu contraseña</h1>
      <p className="text-sm text-gray-500 mb-5">
        Una vez configurada, ya puedes iniciar sesión en tu cuenta.
      </p>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            msg.kind === 'err'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
            Confirma contraseña
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl mt-3"
        >
          {loading ? 'Guardando…' : 'Configurar y entrar'}
        </button>
      </form>
    </div>
  );
}
