"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCLP } from "@jurmaq/shared/format";

interface Cotizacion {
  id: number;
  numero: string;
  fecha: string;
  total: number;
  estado: string;
}

interface UserData {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  rut: string;
}

export default function CuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    empresa: "",
    rut: "",
  });
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("barraca_token");
    if (!token) {
      router.push("/cuenta/login");
      return;
    }

    // Fetch user profile & cotizaciones
    fetch("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "profile" }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then((data) => {
        setUser(data.user);
        setCotizaciones(data.cotizaciones || []);
        setForm({
          nombre: data.user.nombre || "",
          telefono: data.user.telefono || "",
          empresa: data.user.empresa || "",
          rut: data.user.rut || "",
        });
      })
      .catch(() => {
        localStorage.removeItem("barraca_token");
        localStorage.removeItem("barraca_user");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("barraca-auth-changed"));
        }
        router.push("/cuenta/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("barraca_token");
    localStorage.removeItem("barraca_user");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("barraca-auth-changed"));
    }
    router.push("/");
  }

  // Audit A11: derecho de portabilidad/acceso (Ley 21.719). Descarga un
  // JSON con todos los datos personales que tenemos del usuario.
  async function handleExportData() {
    const token = localStorage.getItem("barraca_token");
    if (!token) return;
    try {
      const res = await fetch("/api/cuenta/exportar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "No se pudo generar la exportacion. Intentalo nuevamente.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const fnameMatch = cd.match(/filename="?([^";]+)"?/);
      const filename = fnameMatch?.[1] || `jurmaq-mis-datos-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Error de conexion al exportar tus datos.");
    }
  }

  // Derecho a borrado (Ley 21.719). Endpoint /eliminar requiere password.
  async function handleEliminarCuenta() {
    const token = localStorage.getItem("barraca_token");
    if (!token) return;
    const ok = confirm(
      "Vas a eliminar tu cuenta de barraca.jurmaq.cl.\n\n" +
      "Tus datos personales seran anonimizados; las cotizaciones se mantienen sin tus datos identificables (retencion legal de 6 anos).\n\n" +
      "Esta accion es IRREVERSIBLE. Continuar?"
    );
    if (!ok) return;
    const password = prompt("Confirma tu contrasena para eliminar la cuenta:");
    if (!password) return;
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo eliminar la cuenta.");
        return;
      }
      alert(data.mensaje || "Cuenta eliminada.");
      handleLogout();
    } catch {
      alert("Error de conexion al eliminar la cuenta.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("barraca_token");
    if (!token) return;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "update", ...form }),
      });
      if (res.ok) {
        setSaveMsg("Datos actualizados");
        setEditing(false);
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch {
      /* ignore */
    }
  }

  function estadoBadge(estado: string) {
    const map: Record<string, string> = {
      pendiente: "bg-yellow-100 text-yellow-700",
      enviada: "bg-blue-100 text-blue-700",
      aceptada: "bg-green-100 text-green-700",
      rechazada: "bg-red-100 text-red-700",
      finalizada: "bg-gray-100 text-gray-700",
    };
    return map[estado] || "bg-gray-100 text-gray-700";
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-orange-600 transition-colors">
          Inicio
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy-950 font-medium">Mi Cuenta</span>
      </nav>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-navy-950">
            Hola, {user?.nombre}
          </h1>
          <p className="text-gray-600">{user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportData}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-navy-950 border border-gray-300 rounded-lg hover:border-navy-300 transition-colors"
            title="Descarga un JSON con todos tus datos personales (Ley 21.719)"
          >
            Descargar mis datos
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 border border-gray-300 rounded-lg hover:border-red-300 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cotizaciones */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-navy-950">
                Mis Cotizaciones
              </h2>
            </div>
            {cotizaciones.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 mb-4">
                  No tienes cotizaciones aun
                </p>
                <Link
                  href="/categorias"
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Explorar productos
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Numero
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cotizaciones.map((cot) => (
                      <tr key={cot.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-navy-950">
                          {cot.numero}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(cot.fecha).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatCLP(cot.total)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${estadoBadge(cot.estado)}`}
                          >
                            {cot.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Personal Data */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-navy-950">
                Datos Personales
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Editar
                </button>
              )}
            </div>

            {saveMsg && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
                {saveMsg}
              </div>
            )}

            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value })
                    }
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={form.empresa}
                    onChange={(e) =>
                      setForm({ ...form, empresa: e.target.value })
                    }
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    RUT
                  </label>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={(e) =>
                      setForm({ ...form, rut: e.target.value })
                    }
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 h-10 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 h-10 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Nombre</dt>
                  <dd className="text-sm text-gray-900">
                    {user?.nombre || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">
                    {user?.email || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Telefono
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {user?.telefono || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Empresa
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {user?.empresa || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">RUT</dt>
                  <dd className="text-sm text-gray-900">
                    {user?.rut || "-"}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Zona destructiva — Ley 21.719 derecho a borrado */}
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-900 mb-1">Eliminar cuenta</h3>
            <p className="text-xs text-red-800 mb-3">
              Anonimiza tus datos personales. Las cotizaciones se conservan sin tus datos identificables (retencion legal de 6 anos). Esta accion es irreversible.
            </p>
            <button
              onClick={handleEliminarCuenta}
              className="px-4 py-2 text-sm font-medium text-red-700 hover:text-white hover:bg-red-600 border border-red-300 rounded-lg transition-colors"
            >
              Eliminar mi cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
