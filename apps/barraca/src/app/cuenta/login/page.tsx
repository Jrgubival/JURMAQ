"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
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
      // 1. Try unified barraca auth (checks both barraca_usuarios and users tables)
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const user = data.usuario;
        const source = data.source; // 'barraca' or 'admin'

        try {
          const { trackEvents } = await import("@/lib/analytics");
          trackEvents.login("email");
        } catch { /* analytics no debe romper UX */ }

        // Store token and user in localStorage
        if (data.token) {
          localStorage.setItem("barraca_token", data.token);
        }
        localStorage.setItem(
          "barraca_user",
          JSON.stringify({
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            telefono: user.telefono,
            empresa: user.empresa,
            rut: user.rut,
          })
        );

        // If admin/vendedor, also create NextAuth session for /admin/* pages
        if (source === "admin" || user.rol === "admin" || user.rol === "vendedor") {
          const nextAuthResult = await signIn("credentials", {
            redirect: false,
            email,
            password,
          });

          if (nextAuthResult?.error) {
            console.error("Error al crear sesión NextAuth:", nextAuthResult.error);
          }

          // Cross-origin redirect: admin panel lives on jurmaq.cl (main domain),
          // this login page runs on barraca.jurmaq.cl. Use window.location so the
          // browser actually crosses origins (router.push would stay on subdomain).
          if (typeof window !== "undefined") {
            const isProd = window.location.hostname.endsWith("jurmaq.cl");
            window.location.href = isProd ? "https://jurmaq.cl/admin" : "/admin";
          } else {
            router.push("/admin");
          }
          return;
        }

        // Cliente: full page reload so the Navbar re-reads localStorage and
        // shows the logged-in user widget. router.push preserves the layout
        // tree so the Navbar's mount-only useEffect never re-runs.
        if (typeof window !== "undefined") {
          window.location.href = "/cuenta";
        } else {
          router.push("/cuenta");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Credenciales incorrectas");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-baseline">
            <span className="text-3xl font-extrabold text-navy-950 tracking-tight">
              JURMAQ
            </span>
            <span className="text-xl font-semibold text-orange-600 ml-1">
              Barraca
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-navy-950 mt-4">
            Iniciar sesión
          </h1>
          <p className="text-gray-600 mt-1">
            Ingresa a tu cuenta para ver tus cotizaciones
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Tu contraseña"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 min-h-[48px] bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar a mi cuenta"}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Tu información está segura
          </p>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          ¿No tienes cuenta?{" "}
          <Link
            href="/cuenta/registro"
            className="font-semibold text-orange-600 hover:text-orange-700"
          >
            Crear una cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
