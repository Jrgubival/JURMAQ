'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';

const ESPERA_REENVIO = 60; // segundos

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
    <div className="bg-negro min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-3xl font-extrabold text-white tracking-tight">
            JURMAQ<span className="text-xl font-semibold text-acento ml-1.5">Arriendo</span>
          </p>
          <p className="text-sm text-white/70 mt-2">Panel de administración</p>
        </div>

        <div className="bg-white rounded shadow-xl p-6 sm:p-7">
          {paso === 'correo' ? (
            <form onSubmit={enviarCorreo} noValidate className="space-y-5">
              <div>
                <h1 className="text-lg font-bold text-ink">Entrar al panel</h1>
                <p className="text-sm text-ink-muted mt-1">Te mandamos un código a tu correo. Sin contraseña.</p>
              </div>
              <div>
                <label htmlFor="login-correo" className="block text-sm font-medium text-ink mb-1.5">
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
                  className="campo"
                  placeholder="tu@correo.cl"
                />
              </div>
              {error && (
                <p id="login-error" role="alert" className="rounded-lg border border-peligro px-3 py-2.5 text-sm text-peligro">
                  {error}
                </p>
              )}
              <button type="submit" disabled={cargando} className="boton boton-principal w-full">
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
                <h1 className="text-lg font-bold text-ink">Revisa tu correo</h1>
                <p className="text-sm text-ink-muted mt-1" aria-live="polite">
                  {aviso} Sirve por 10 minutos.
                </p>
                <p className="text-sm text-ink font-medium mt-1 break-all">{email.trim().toLowerCase()}</p>
              </div>
              <div>
                <label htmlFor="login-codigo" className="block text-sm font-medium text-ink mb-1.5">
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
                  className={`campo h-14 text-center text-2xl font-bold tracking-[0.5em] font-mono`}
                  placeholder="••••••"
                />
              </div>
              {error && (
                <p id="login-error" role="alert" className="rounded-lg border border-peligro px-3 py-2.5 text-sm text-peligro">
                  {error}
                </p>
              )}
              <button type="submit" disabled={cargando || codigo.length !== 6} className="boton boton-principal w-full">
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
                  className="min-h-11 text-ink-muted underline underline-offset-2"
                >
                  Cambiar correo
                </button>
                <button
                  type="button"
                  onClick={() => void pedirCodigo().then((ok) => ok && setCodigo(''))}
                  disabled={cargando || espera > 0}
                  className="min-h-11 font-semibold text-ink underline disabled:text-ink-muted disabled:cursor-not-allowed"
                >
                  {espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/60 mt-6">Acceso solo para personal autorizado de JURMAQ.</p>
      </div>
    </div>
  );
}
