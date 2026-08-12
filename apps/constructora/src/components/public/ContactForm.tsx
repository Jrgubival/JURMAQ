"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const servicios = [
  { value: "", label: "Seleccione un servicio" },
  { value: "constructora", label: "Constructora - Obras Civiles" },
  { value: "arriendo", label: "Arriendo de Maquinaria" },
  { value: "maestranza", label: "Maestranza" },
  { value: "barraca", label: "Barraca de Fierros" },
  { value: "otro", label: "Otro" },
];

interface FormData {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  servicio: string;
  mensaje: string;
}

interface ContactFormProps {
  /**
   * Preselecciona el servicio. Lo usa `/cotizar-obra` en
   * constructora.jurmaq.cl, donde el visitante ya llegó buscando obra civil y
   * pedirle que lo elija de nuevo es fricción pura. El query param `?servicio=`
   * sigue mandando por sobre esto (ver useEffect).
   */
  servicioInicial?: string;
  /** Placeholder del textarea, para adaptar la pregunta al contexto. */
  mensajePlaceholder?: string;
}

export function ContactForm({ servicioInicial = "", mensajePlaceholder }: ContactFormProps = {}) {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    empresa: "",
    email: "",
    telefono: "",
    servicio: servicioInicial,
    mensaje: "",
  });
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

  useEffect(() => {
    const servicio = searchParams.get("servicio") || "";
    const maquinaria = searchParams.get("maquinaria") || "";

    if (servicio || maquinaria) {
      setFormData((prev) => ({
        ...prev,
        servicio: servicio || prev.servicio,
        mensaje: maquinaria
          ? `Solicito cotización para arriendo de: ${maquinaria}`
          : prev.mensaje,
      }));
    }
  }, [searchParams]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aceptaPrivacidad) {
      setStatus("error");
      setErrorMessage("Debes aceptar la Politica de Privacidad para enviar tu mensaje");
      return;
    }
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: formData.nombre,
          clienteEmpresa: formData.empresa,
          clienteEmail: formData.email,
          clienteTelefono: formData.telefono,
          servicio: formData.servicio,
          mensaje: formData.mensaje,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al enviar la solicitud");
      }

      setStatus("success");
      setFormData({
        nombre: "",
        empresa: "",
        email: "",
        telefono: "",
        servicio: "",
        mensaje: "",
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Error al enviar la solicitud"
      );
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-green-100 rounded-full">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-navy-950 mb-2">
          Solicitud enviada con exito
        </h3>
        <p className="text-gray-600 mb-6">
          Recibimos tu solicitud. Te contactamos en menos de 2 horas en horario laboral.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="inline-flex items-center gap-2 px-6 py-3 bg-navy-950 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Nombre */}
        <div>
          <label
            htmlFor="nombre"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            autoComplete="name"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="Juan Pérez"
            className="w-full h-12 min-h-[48px] px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Empresa */}
        <div>
          <label
            htmlFor="empresa"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Empresa (opcional)
          </label>
          <input
            type="text"
            id="empresa"
            name="empresa"
            autoComplete="organization"
            value={formData.empresa}
            onChange={handleChange}
            placeholder="Nombre de tu empresa"
            className="w-full h-12 min-h-[48px] px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Correo electrónico
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="correo@empresa.cl"
            className="w-full h-12 min-h-[48px] px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label
            htmlFor="telefono"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="telefono"
            name="telefono"
            autoComplete="tel"
            inputMode="tel"
            value={formData.telefono}
            onChange={handleChange}
            required
            placeholder="+56 9 1234 5678"
            className="w-full h-12 min-h-[48px] px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Servicio */}
      <div>
        <label
          htmlFor="servicio"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Servicio de interés
        </label>
        <select
          id="servicio"
          name="servicio"
          value={formData.servicio}
          onChange={handleChange}
          className="w-full h-12 min-h-[48px] px-4 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow bg-white appearance-none"
        >
          {servicios.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mensaje */}
      <div>
        <label
          htmlFor="mensaje"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Mensaje o descripción del proyecto
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          value={formData.mensaje}
          onChange={handleChange}
          rows={5}
          placeholder={mensajePlaceholder ?? "Describe brevemente tu necesidad o proyecto…"}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow resize-none"
        />
      </div>

      {/* Legal: privacy policy consent */}
      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          required
          checked={aceptaPrivacidad}
          onChange={(e) => setAceptaPrivacidad(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gold-500 focus:ring-gold-500 shrink-0"
        />
        <span>
          He leido y acepto la{" "}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-gold-700 hover:underline font-medium">Politica de Privacidad</a>{" "}
          y autorizo el tratamiento de mis datos personales para responder esta consulta, conforme a la Ley N&deg; 19.628. <span className="text-red-500">*</span>
        </span>
      </label>

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full inline-flex items-center justify-center gap-2 px-8 h-13 min-h-[52px] py-3.5 bg-gold-500 hover:bg-gold-600 active:bg-gold-700 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-950 font-bold text-base rounded-xl transition-colors touch-manipulation"
        >
          {status === "submitting" ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Enviando...
            </>
          ) : (
            <>
              Pedir presupuesto gratis
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Sin compromiso — No compartimos tu informacion
        </p>
      </div>
    </form>
  );
}
