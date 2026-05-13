"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: "",
    telefono: "",
    empresa: "",
    rut: "",
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.password) {
      setError("Completa los campos obligatorios");
      return;
    }
    if (!aceptaTerminos) {
      setError("Debes aceptar los Terminos y Condiciones y la Politica de Privacidad para crear tu cuenta");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError("La contraseña debe incluir al menos una letra mayuscula y un numero");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          telefono: form.telefono,
          empresa: form.empresa,
          rut: form.rut,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        try {
          const { trackEvents } = await import("@/lib/analytics");
          trackEvents.signUp("email");
        } catch { /* analytics no debe romper UX */ }
        localStorage.setItem("barraca_token", data.token);
        if (data.usuario) {
          localStorage.setItem("barraca_user", JSON.stringify({
            id: data.usuario.id,
            nombre: data.usuario.nombre,
            email: data.usuario.email,
            rol: data.usuario.rol || 'cliente',
            telefono: data.usuario.telefono,
            empresa: data.usuario.empresa,
            rut: data.usuario.rut,
          }));
        }
        if (typeof window !== "undefined") {
          window.location.href = "/cuenta";
        } else {
          router.push("/cuenta");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Error al registrarse");
      }
    } catch {
      setError("Error de conexión");
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
            Crear cuenta
          </h1>
          <p className="text-gray-600 mt-1">
            Regístrate para gestionar tus cotizaciones
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <label htmlFor="reg-nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo *
            </label>
            <input
              id="reg-nombre"
              type="text"
              name="nombre"
              autoComplete="name"
              value={form.nombre}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              id="reg-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="tu@email.com"
            />
          </div>

          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña *
              </label>
              <input
                id="reg-password"
                type="password"
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="reg-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar *
              </label>
              <input
                id="reg-confirmPassword"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-telefono" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              id="reg-telefono"
              type="tel"
              name="telefono"
              inputMode="tel"
              autoComplete="tel"
              value={form.telefono}
              onChange={handleChange}
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="+56 9 1234 5678"
            />
          </div>

          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-empresa" className="block text-sm font-medium text-gray-700 mb-1">
                Empresa
              </label>
              <input
                id="reg-empresa"
                type="text"
                name="empresa"
                autoComplete="organization"
                value={form.empresa}
                onChange={handleChange}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="reg-rut" className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                id="reg-rut"
                type="text"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                placeholder="12.345.678-9"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              required
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span>
              He leido y acepto los{" "}
              <Link href="https://jurmaq.cl/terminos" target="_blank" className="text-orange-600 hover:underline font-medium">
                Terminos y Condiciones
              </Link>{" "}
              y la{" "}
              <Link href="https://jurmaq.cl/privacidad" target="_blank" className="text-orange-600 hover:underline font-medium">
                Politica de Privacidad
              </Link>
              , y autorizo el tratamiento de mis datos personales conforme a la Ley N&deg; 19.628. <span className="text-red-500">*</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 min-h-[48px] bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear mi cuenta gratis"}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Sin costo — Solo necesitas un email para empezar a cotizar
          </p>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/cuenta/login"
            className="font-semibold text-orange-600 hover:text-orange-700"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
