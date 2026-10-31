"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginCredenciales({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Completa todos los campos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await signIn("credentials", { redirect: false, email, password });
      if (!r || r.error) {
        setError("Credenciales incorrectas");
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-extrabold text-navy-950 tracking-tight">
            JURMAQ<span className="text-xl font-semibold text-marca-600 ml-1 align-baseline">Barraca</span>
          </span>
          <p className="text-sm text-gray-500 mt-2">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-6 space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-marca-500 focus:border-marca-500"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-marca-500 focus:border-marca-500"
            />
          </div>

          {error && (
            <div role="alert" className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-navy-950 hover:bg-navy-800 text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso solo para personal autorizado de JURMAQ.{" "}
          <a href="/login" className="underline underline-offset-2 hover:text-navy-950">Entrar con Google</a>
        </p>
      </div>
    </div>
  );
}
