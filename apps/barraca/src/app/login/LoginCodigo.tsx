'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';

const ESPERA_REENVIO = 60; // segundos

const inputBase =
  'w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-base text-navy-950 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-marca-600/40 focus:border-marca-600 transition-colors';

const botonPrimario =
  'w-full h-12 rounded-xl bg-marca-600 hover:bg-marca-700 active:bg-marca-800 text-white font-semibold text-base ' +
  'transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marca-600';

export default function LoginCodigo({ callbackUrl }: { callbackUrl: string }) {
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [espera, setEspera] = useState(0);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  useEffect(() => {
    if (paso === 'codigo') codigoRef.current?.focus();
  }, [paso]);

  async function pedirCodigo(): Promise<boolean> {
    setError('');
    setCargando(true);
    try {
      const r = await fetch('/api/login/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await r.json().catch(() => ({}))) as { mensaje?: string; error?: string };
      if (!r.ok) {
        setError(data.error || 'No se pudo enviar el código. Intenta de nuevo.');
        return false;
      }
      setAviso(data.mensaje || 'Si el correo tiene acceso, te llegó un código.');
      setEspera(ESPERA_REENVIO);
      return true;
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
      return false;
    } finally {
      setCargando(false);
    }
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Escribe tu correo.');
      return;
    }
    if (await pedirCodigo()) {
      setCodigo('');
      setPaso('codigo');
    }
  }

  async function entrar(valor: string) {
    if (!/^\d{6}$/.test(valor)) {
      setError('El código tiene 6 números.');
      return;
    }
    setError('');
    setCargando(true);
    try {
      const r = await signIn('codigo-correo', { email: email.trim(), codigo: valor, redirect: false });
      if (!r || r.error) {
        const limite = (r as { code?: string } | undefined)?.code === 'limite';
        setError(
          limite
            ? 'Hiciste muchos intentos. Espera unos minutos y vuelve a intentar.'
            : 'Código incorrecto o vencido.',
        );
        setCodigo('');
        codigoRef.current?.focus();
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  function cambiarCodigo(v: string) {
    const limpio = v.replace(/\D/g, '').slice(0, 6);
    setCodigo(limpio);
    if (error) setError('');
    if (limpio.length === 6 && !cargando) void entrar(limpio);
  }

  return (
    <div className="bg-navy-950 min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-3xl font-extrabold text-white tracking-tight">
            JURMAQ<span className="text-xl font-semibold text-marca-400 ml-1.5">Barraca</span>
          </p>
          <p className="text-sm text-navy-200 mt-2">Panel de administración</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-7">
          {paso === 'correo' ? (
            <form onSubmit={enviarCorreo} noValidate className="space-y-5">
              <div>
                <h1 className="text-lg font-bold text-navy-950">Entrar al panel</h1>
                <p className="text-sm text-gray-600 mt-1">Te mandamos un código a tu correo. Sin contraseña.</p>
              </div>
              <div>
                <label htmlFor="login-correo" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo
                </label>
                <input
                  id="login-correo"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                  className={inputBase}
                  placeholder="tu@correo.cl"
                />
              </div>
              {error && (
                <p id="login-error" role="alert" className="rounded-lg bg-marca-50 border border-marca-200 px-3 py-2.5 text-sm text-marca-800">
                  {error}
                </p>
              )}
              <button type="submit" disabled={cargando} className={botonPrimario}>
                {cargando ? 'Enviando…' : 'Enviar código'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void entrar(codigo);
              }}
              noValidate
              className="space-y-5"
            >
              <div>
                <h1 className="text-lg font-bold text-navy-950">Revisa tu correo</h1>
                <p className="text-sm text-gray-600 mt-1" aria-live="polite">
                  {aviso} Sirve por 10 minutos.
                </p>
                <p className="text-sm text-navy-950 font-medium mt-1 break-all">{email.trim().toLowerCase()}</p>
              </div>
              <div>
                <label htmlFor="login-codigo" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código de 6 números
                </label>
                <input
                  ref={codigoRef}
                  id="login-codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => cambiarCodigo(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className={`${inputBase} h-14 text-center text-2xl font-bold tracking-[0.5em] font-mono`}
                  placeholder="••••••"
                />
              </div>
              {error && (
                <p id="login-error" role="alert" className="rounded-lg bg-marca-50 border border-marca-200 px-3 py-2.5 text-sm text-marca-800">
                  {error}
                </p>
              )}
              <button type="submit" disabled={cargando || codigo.length !== 6} className={botonPrimario}>
                {cargando ? 'Entrando…' : 'Entrar'}
              </button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setPaso('correo');
                    setError('');
                    setCodigo('');
                  }}
                  className="min-h-11 text-gray-600 hover:text-navy-950 underline underline-offset-2"
                >
                  Cambiar correo
                </button>
                <button
                  type="button"
                  onClick={() => void pedirCodigo().then((ok) => ok && setCodigo(''))}
                  disabled={cargando || espera > 0}
                  className="min-h-11 font-semibold text-marca-700 hover:text-marca-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-navy-300 mt-6">Acceso solo para personal autorizado de JURMAQ.</p>
      </div>
    </div>
  );
}
