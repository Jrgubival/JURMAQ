'use client';

import { useState } from 'react';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginClient() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rut, setRut] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const body: Record<string, string> = { action: mode, email };
      if (mode === 'login') body.password = password;
      if (mode === 'register') {
        body.password = password;
        body.nombre = nombre;
        body.telefono = telefono;
        body.rut = rut;
        body.empresa = empresa;
      }
      const res = await fetch('/api/cuenta/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (mode === 'forgot') {
        setMsg({ kind: 'info', text: data.message || 'Si el email existe, te enviamos instrucciones.' });
        return;
      }

      if (res.status === 412 && data.error === 'configurar_password') {
        setMsg({
          kind: 'info',
          text: data.message || 'Te enviamos un correo para configurar tu contraseña.',
        });
        // Trigger forgot flow automáticamente.
        void fetch('/api/cuenta/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'forgot', email }),
        });
        return;
      }

      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error desconocido' });
        return;
      }

      // Éxito: redirigir al dashboard.
      window.location.href = '/cuenta';
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {mode === 'login' && 'Iniciar sesión'}
        {mode === 'register' && 'Crear cuenta'}
        {mode === 'forgot' && 'Recuperar contraseña'}
      </h1>
      <p className="text-sm text-gray-500 mb-5">
        {mode === 'login' && 'Accede a tus cotizaciones, contratos y perfil.'}
        {mode === 'register' && 'Crea tu cuenta para gestionar tus arriendos.'}
        {mode === 'forgot' && 'Te enviaremos un correo para restablecer la contraseña.'}
      </p>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : msg.kind === 'info'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
        </div>

        {mode !== 'forgot' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : 6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
            {mode === 'register' && (
              <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p>
            )}
          </div>
        )}

        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
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
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                  placeholder="12345678-9"
                />
              </div>
            </div>
            <div>
              <label htmlFor="empresa" className="block text-sm font-medium text-gray-700 mb-1">
                Empresa (opcional)
              </label>
              <input
                id="empresa"
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl mt-4"
        >
          {loading
            ? 'Procesando…'
            : mode === 'login'
              ? 'Iniciar sesión'
              : mode === 'register'
                ? 'Crear cuenta'
                : 'Enviar correo'}
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-2">
        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-orange-600 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <div>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-orange-600 hover:underline font-medium"
              >
                Crear una
              </button>
            </div>
          </>
        )}
        {mode === 'register' && (
          <div>
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-orange-600 hover:underline font-medium"
            >
              Inicia sesión
            </button>
          </div>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-orange-600 hover:underline"
          >
            Volver a iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}
