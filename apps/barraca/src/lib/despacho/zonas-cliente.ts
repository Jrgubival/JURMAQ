"use client";

import { useEffect, useState } from "react";
import { ZONAS_DESPACHO, type ZonaDespacho } from "./zonas";

/**
 * Zonas con las tarifas vigentes (las que se editan en el panel), para el
 * navegador. Mientras carga o si falla, usa las de zonas.ts. Sólo informan:
 * lo que se cobra lo calcula el servidor al crear el pedido.
 */
let actuales: ZonaDespacho[] = ZONAS_DESPACHO;
let pedido: Promise<void> | null = null;
const EVENTO = "barraca:zonas";

function cargar(): Promise<void> {
  pedido ??= fetch("/api/tienda/zonas")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { zonas?: ZonaDespacho[] } | null) => {
      const lista = d?.zonas?.filter((z) => typeof z.id === "string" && Number.isInteger(z.costo));
      if (lista && lista.length > 0) {
        actuales = lista;
        window.dispatchEvent(new Event(EVENTO));
      }
    })
    .catch(() => { /* quedan las de zonas.ts */ });
  return pedido;
}

export function useZonas(): ZonaDespacho[] {
  const [lista, setLista] = useState<ZonaDespacho[]>(actuales);
  useEffect(() => {
    const sync = () => setLista(actuales);
    window.addEventListener(EVENTO, sync);
    void cargar().then(sync);
    return () => window.removeEventListener(EVENTO, sync);
  }, []);
  return lista;
}

export function zonaEn(lista: ZonaDespacho[], id: string | null | undefined): ZonaDespacho | null {
  return (id && lista.find((z) => z.id === id)) || null;
}
