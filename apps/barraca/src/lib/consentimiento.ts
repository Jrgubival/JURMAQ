"use client";

import { useEffect, useState } from "react";

/**
 * ¿La persona apretó "Aceptar" en el aviso de cookies? Lee la elección guardada
 * (`consent_v2`, la escribe CookieBanner) y escucha el evento `jurmaq:consent`
 * por si acepta durante la visita. Sin elección, o con "Solo esencial": false.
 */
export function consentimientoGuardado(): boolean {
  try {
    const r = localStorage.getItem("consent_v2");
    return !!r && JSON.parse(r).accepted === true;
  } catch {
    return false;
  }
}

export function useConsentimiento(): boolean {
  const [aceptado, setAceptado] = useState(false);
  useEffect(() => {
    setAceptado(consentimientoGuardado());
    const alCambiar = (e: Event) => setAceptado(!!(e as CustomEvent<{ granted: boolean }>).detail?.granted);
    window.addEventListener("jurmaq:consent", alCambiar);
    return () => window.removeEventListener("jurmaq:consent", alCambiar);
  }, []);
  return aceptado;
}
