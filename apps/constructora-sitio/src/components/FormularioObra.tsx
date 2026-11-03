"use client";

import { useState, type FormEvent } from "react";
import { API_SOLICITUDES, EMPRESA } from "@/data/empresa";
import { SERVICIOS } from "@/data/servicios";

// El envío depende de que jurmaq.cl acepte este origen por CORS en /api/solicitudes.
type Estado = "listo" | "enviando" | "enviado" | "error";

export default function FormularioObra() {
  const [estado, setEstado] = useState<Estado>("listo");

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setEstado("enviando");
    try {
      const res = await fetch(API_SOLICITUDES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: datos.get("nombre"),
          clienteEmpresa: datos.get("empresa"),
          clienteEmail: datos.get("correo"),
          clienteTelefono: datos.get("telefono"),
          servicio: datos.get("servicio"),
          mensaje: datos.get("mensaje"),
        }),
      });
      setEstado(res.ok ? "enviado" : "error");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "enviado") {
    return (
      <p className="mensaje-ok" role="status">
        Recibimos tu solicitud. Te contactamos para revisar el alcance de la obra.
      </p>
    );
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campos-dobles">
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" required autoComplete="name" maxLength={120} />
        </div>
        <div className="campo">
          <label htmlFor="empresa">Empresa (opcional)</label>
          <input id="empresa" name="empresa" autoComplete="organization" maxLength={120} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" type="tel" required autoComplete="tel" maxLength={30} />
        </div>
        <div className="campo">
          <label htmlFor="correo">Correo (opcional)</label>
          <input id="correo" name="correo" type="email" autoComplete="email" maxLength={160} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="servicio">Tipo de obra (opcional)</label>
        <select id="servicio" name="servicio" defaultValue="">
          <option value="">Elegir</option>
          {SERVICIOS.map((s) => (
            <option key={s.slug} value={s.corto}>
              {s.corto}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="mensaje">Alcance de la obra</label>
        <textarea id="mensaje" name="mensaje" rows={5} required maxLength={2000} />
      </div>
      <label className="casilla">
        <input type="checkbox" name="privacidad" required />
        <span>
          Acepto la <a href="https://jurmaq.cl/privacidad">política de privacidad</a>.
        </span>
      </label>
      {estado === "error" && (
        <p className="mensaje-error" role="alert">
          No se pudo enviar. Llámanos al {EMPRESA.telefonoVisible}.
        </p>
      )}
      <div>
        <button className="boton boton-formulario" type="submit" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Enviando…" : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
}
