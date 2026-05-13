"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { showToast } from "@/components/Toast";
import { formatCLP } from "@jurmaq/shared/format";

interface CartItem {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  medida: string | null;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("barraca_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("barraca_session_id", sid);
  }
  return sid;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Carrito" },
    { num: 2, label: "Datos" },
    { num: 3, label: "Confirmar" },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                currentStep >= step.num
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {currentStep > step.num ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <span className={`text-xs mt-1.5 font-medium ${currentStep >= step.num ? "text-orange-600" : "text-gray-500"}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors ${currentStep > step.num ? "bg-orange-600" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CotizarPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ numero: string; id?: number } | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    empresa: "",
    email: "",
    telefono: "",
    rut: "",
    notas: "",
    // Facturación (opcionales)
    razon_social: "",
    giro: "",
    direccion_factura: "",
  });
  const [quiereFactura, setQuiereFactura] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<{ nombre: string; email: string; telefono: string; empresa: string; rut: string } | null>(null);
  const [usandoCuenta, setUsandoCuenta] = useState(true);

  // Competitor quote state
  const [tieneCompetencia, setTieneCompetencia] = useState(false);
  const [nombreCompetencia, setNombreCompetencia] = useState("");
  const [archivoCompetencia, setArchivoCompetencia] = useState<File | null>(null);
  const [notasCompetencia, setNotasCompetencia] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Legal: consent to terms and privacy policy (required)
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);

  useEffect(() => {
    const sid = getSessionId();
    fetch("/api/barraca/carrito", { headers: { "X-Session-Id": sid } })
      .then((r) => r.json())
      .then((d) => {
        const list: CartItem[] = d.items || [];
        setItems(list);
        if (list.length > 0) {
          import("@/lib/analytics")
            .then(({ trackEvents }) =>
              trackEvents.beginCheckout(
                list.map((it) => ({
                  id: it.id,
                  nombre: it.nombre,
                  precio: it.precio,
                  cantidad: it.cantidad,
                }))
              )
            )
            .catch(() => { /* analytics no debe romper UX */ });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Read user data from localStorage (saved at login)
    try {
      const stored = localStorage.getItem("barraca_user");
      if (stored) {
        const user = JSON.parse(stored);
        const ud = {
          nombre: user.nombre || "",
          email: user.email || "",
          telefono: user.telefono || "",
          empresa: user.empresa || "",
          rut: user.rut || "",
        };
        setUserData(ud);
        setIsLoggedIn(true);
        setUsandoCuenta(true);
        // Pre-fill form with account data
        setForm((f) => ({ ...f, ...ud }));
      }
    } catch { /* no user data */ }
  }, []);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.telefono) {
      setError("Completa los campos obligatorios");
      return;
    }
    if (!aceptaTerminos) {
      setError("Debes aceptar los Terminos y Condiciones y la Politica de Privacidad para continuar");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Upload competitor file if present
      let cotizacionCompetenciaUrl = "";
      if (tieneCompetencia && archivoCompetencia) {
        setUploadingFile(true);
        const formDataUpload = new FormData();
        formDataUpload.append("file", archivoCompetencia);
        const uploadRes = await fetch("/api/barraca/upload", {
          method: "POST",
          body: formDataUpload,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          cotizacionCompetenciaUrl = uploadData.url;
          try {
            const { trackEvents } = await import("@/lib/analytics");
            trackEvents.generateLead("mejora_precio", total);
          } catch { /* analytics no debe romper UX */ }
        } else {
          const uploadErr = await uploadRes.json();
          setError(uploadErr.error || "Error al subir archivo");
          setUploadingFile(false);
          setSubmitting(false);
          return;
        }
        setUploadingFile(false);
      }

      let usuarioId: number | null = null;
      try {
        const storedUser = localStorage.getItem('barraca_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.id) usuarioId = parsed.id;
        }
      } catch { /* no user */ }

      const sid = getSessionId();
      const res = await fetch("/api/barraca/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precio,
            medida: i.medida,
          })),
          total,
          sessionId: sid,
          usuario_id: usuarioId,
          ...(tieneCompetencia && {
            cotizacion_competencia: cotizacionCompetenciaUrl,
            nombre_competencia: nombreCompetencia,
            notas_competencia: notasCompetencia,
          }),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess({ numero: data.numero || "COT-000000", id: data.id });
        localStorage.removeItem("barraca_session_id");
        window.dispatchEvent(new Event("cart-updated"));
        showToast("Cotización enviada exitosamente", "success");

        // If the client opted into marketing, subscribe them to the newsletter.
        // Fire-and-forget; duplicates/rate-limits are silently ignored.
        if (aceptaMarketing && form.email) {
          fetch("/api/barraca/suscriptores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, nombre: form.nombre || "" }),
          }).catch(() => {});
        }
      } else {
        const data = await res.json();
        const errMsg = data.error || "Error al enviar cotización";
        setError(errMsg);
        showToast(errMsg, "error");
      }
    } catch {
      setError("Error de conexión");
      showToast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!loading && items.length === 0 && !success) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center max-w-lg mx-auto">
          <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <h1 className="text-xl font-bold text-navy-950 mb-2">Tu carrito está vacío</h1>
          <p className="text-gray-500 mb-6">Agrega productos antes de solicitar una cotización.</p>
          <Link href="/categorias" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors">
            Explorar categorías
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <StepIndicator currentStep={3} />
        <div className="bg-white border border-gray-200 rounded-xl p-8 lg:p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-navy-950 mb-2">Cotización enviada</h1>
          <div className="inline-block px-4 py-2 bg-orange-100 text-orange-700 font-bold text-lg rounded-lg mb-4">
            #{success.numero}
          </div>

          {/* Email confirmation notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-blue-800">
                Te enviamos un correo de confirmación a {form.email}
              </span>
            </div>
            <p className="text-xs text-blue-600">
              Revisa tu bandeja de entrada (y spam) para ver el detalle de tu cotización.
            </p>
          </div>

          <p className="text-gray-600 mb-3">Tu cotización ha sido enviada.</p>
          <p className="text-sm text-gray-500 mb-6">
            Te contactaremos para confirmar disponibilidad y enviar el link de pago.
          </p>

          {/* Payment info */}
          <div className="border-t border-gray-200 pt-6 mb-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-left space-y-3">
              <h2 className="text-sm font-semibold text-navy-950 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Métodos de pago disponibles
              </h2>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  MercadoPago (tarjetas, transferencia)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  Efectivo (transferencia bancaria)
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 text-amber-800">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">
                  Tiempo de respuesta: 1-2 horas en horario laboral
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`https://wa.me/56976673577?text=${encodeURIComponent(`Hola, acabo de enviar la cotización ${success.numero}. Quedo atento a la confirmación.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-green-500 text-green-700 hover:bg-green-50 font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Consultar por WhatsApp
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-orange-600 transition-colors">Inicio</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href="/carrito" className="hover:text-orange-600 transition-colors">Carrito</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy-950 font-medium">Cotizar</span>
      </nav>

      <StepIndicator currentStep={2} />

      <h1 className="text-2xl lg:text-3xl font-bold text-navy-950 mb-8 text-center">
        Datos para la cotización
      </h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 lg:p-8 space-y-6">
            {/* Account data selector */}
            {isLoggedIn && userData && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Hola, {userData.nombre}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUsandoCuenta(true);
                      setForm(f => ({ ...f, ...userData }));
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      usandoCuenta
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Usar datos de mi cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsandoCuenta(false);
                      setForm(f => ({ ...f, nombre: '', email: '', telefono: '', empresa: '', rut: '' }));
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      !usandoCuenta
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Ingresar datos nuevos
                  </button>
                </div>
                {usandoCuenta && (
                  <p className="text-xs text-blue-600">Puedes modificar los datos antes de enviar.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="floating-label-group">
                <input type="text" id="cot-nombre" name="nombre" autoComplete="name" value={form.nombre} onChange={handleChange} required placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer" />
                <label htmlFor="cot-nombre">Nombre completo *</label>
              </div>
              <div className="floating-label-group">
                <input type="text" id="cot-empresa" name="empresa" autoComplete="organization" value={form.empresa} onChange={handleChange} placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer" />
                <label htmlFor="cot-empresa">Empresa</label>
              </div>
              <div className="floating-label-group">
                <input type="email" id="cot-email" name="email" inputMode="email" autoComplete="email" value={form.email} onChange={handleChange} required placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer" />
                <label htmlFor="cot-email">Email *</label>
              </div>
              <div className="floating-label-group">
                <input type="tel" id="cot-telefono" name="telefono" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={handleChange} required placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer" />
                <label htmlFor="cot-telefono">Teléfono *</label>
              </div>
              <div className="floating-label-group md:col-span-2">
                <input type="text" id="cot-rut" name="rut" value={form.rut} onChange={handleChange} placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer" />
                <label htmlFor="cot-rut">RUT (ej: 12.345.678-9)</label>
              </div>
            </div>

            {/* Datos de factura (opcionales) */}
            <div className="mt-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input type="checkbox" checked={quiereFactura} onChange={(e) => setQuiereFactura(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                Necesito factura
              </label>
            </div>

            {quiereFactura && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="md:col-span-2 text-xs text-gray-500 mb-1">Datos para facturación (opcionales)</p>
                <div className="floating-label-group">
                  <input type="text" id="cot-razon" name="razon_social" value={form.razon_social} onChange={handleChange} placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer bg-white" />
                  <label htmlFor="cot-razon">Razón Social</label>
                </div>
                <div className="floating-label-group">
                  <input type="text" id="cot-giro" name="giro" value={form.giro} onChange={handleChange} placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer bg-white" />
                  <label htmlFor="cot-giro">Giro</label>
                </div>
                <div className="floating-label-group md:col-span-2">
                  <input type="text" id="cot-dir-factura" name="direccion_factura" value={form.direccion_factura} onChange={handleChange} placeholder=" " className="w-full h-12 px-4 pt-2 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 peer bg-white" />
                  <label htmlFor="cot-dir-factura">Dirección de facturación</label>
                </div>
              </div>
            )}

            <div className="floating-label-group mt-4">
              <textarea id="cot-notas" name="notas" value={form.notas} onChange={handleChange} rows={3} placeholder=" " className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 resize-none text-gray-900 peer" />
              <label htmlFor="cot-notas">Notas adicionales (despacho, plazos...)</label>
            </div>

            {/* Competitor Quote Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-orange-50 rounded-lg p-3 flex-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="tieneCompetencia"
                      checked={tieneCompetencia}
                      onChange={(e) => setTieneCompetencia(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0"
                    />
                    <label htmlFor="tieneCompetencia" className="cursor-pointer">
                      <span className="font-semibold text-gray-900 text-sm block">Tengo una cotización de otro lugar</span>
                      <span className="text-xs text-gray-500">Sube la cotización de la competencia y te mejoramos el precio</span>
                    </label>
                  </div>
                </div>
              </div>

              {tieneCompetencia && (
                <div className="space-y-4 pl-1 border-l-2 border-orange-200 ml-2 pb-1">
                  <div className="pl-4">
                    <label htmlFor="cot-competencia-origen" className="block text-sm font-medium text-gray-700 mb-1.5">¿De dónde es la cotización? *</label>
                    <select
                      id="cot-competencia-origen"
                      value={nombreCompetencia}
                      onChange={(e) => setNombreCompetencia(e.target.value)}
                      className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 text-gray-900 bg-white"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Sodimac">Sodimac</option>
                      <option value="Easy">Easy</option>
                      <option value="Prodalam">Prodalam</option>
                      <option value="Construmart">Construmart</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div className="pl-4">
                    <label htmlFor="cot-competencia-archivo" className="block text-sm font-medium text-gray-700 mb-1.5">Sube la cotización (PDF o imagen) *</label>
                    <div className="relative">
                      <input
                        id="cot-competencia-archivo"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setArchivoCompetencia(e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 cursor-pointer"
                      />
                      {archivoCompetencia && (
                        <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {archivoCompetencia.name} ({(archivoCompetencia.size / 1024 / 1024).toFixed(1)} MB)
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Máximo 10MB. Formatos: PDF, JPG, PNG</p>
                  </div>

                  <div className="pl-4">
                    <label htmlFor="cot-competencia-notas" className="block text-sm font-medium text-gray-700 mb-1.5">¿Qué productos necesitas que te mejoremos? (opcional)</label>
                    <textarea
                      id="cot-competencia-notas"
                      value={notasCompetencia}
                      onChange={(e) => setNotasCompetencia(e.target.value)}
                      rows={2}
                      placeholder="Ej: Necesito mejorar el precio de las tablas de pino y los clavos..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-0 focus:border-orange-500 resize-none text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Legal: terms + optional marketing consent */}
            <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0"
                />
                <span>
                  He leido y acepto los{" "}
                  <a href="/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">Terminos y Condiciones</a>{" "}y la{" "}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">Politica de Privacidad</a>, y autorizo el tratamiento de mis datos personales conforme a la Ley N&deg; 19.628. <span className="text-red-500">*</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceptaMarketing}
                  onChange={(e) => setAceptaMarketing(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0"
                />
                <span>Deseo recibir ofertas, novedades y promociones por correo (opcional).</span>
              </label>
            </div>

            <div>
              <button type="submit" disabled={submitting} className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-base">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {uploadingFile ? "Subiendo archivo..." : "Enviando..."}
                  </span>
                ) : (
                  "Enviar cotización — Sin compromiso"
                )}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Te respondemos en menos de 2 horas en horario laboral
              </p>
            </div>
          </form>
        </div>

        {/* Order Summary Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-24">
            <h2 className="text-lg font-bold text-navy-950 mb-4">Tu Pedido ({totalItems})</h2>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-500">{item.medida ? `${item.medida} - ` : ""}x{item.cantidad}</p>
                  </div>
                  <span className="font-medium text-gray-900 shrink-0">{formatCLP((item.precio * item.cantidad))}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal neto</span>
                <span>{formatCLP(Math.round(total / 1.19))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IVA (19%)</span>
                <span>{formatCLP((total - Math.round(total / 1.19)))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Despacho</span>
                <span className="text-gray-500">Por cotizar segun comuna</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                <span>Total (IVA incluido)</span>
                <span className="text-orange-600">{formatCLP(total)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">* Los precios son referenciales y pueden variar. Te confirmamos el valor final.</p>
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
              Al enviar esta cotizacion aceptas los terminos del servicio. Consulta nuestras{" "}
              <a href="/terminos#garantia" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">politicas de garantia y devolucion</a>.
            </p>
            <Link href="/carrito" className="block text-center text-sm text-orange-600 font-medium hover:text-orange-700 mt-4 transition-colors">
              Modificar carrito
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
