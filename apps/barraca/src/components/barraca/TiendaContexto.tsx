"use client";

import { createContext, useContext, type ReactNode } from "react";
import { vistaLocal, type VistaLocal } from "@/lib/contenido/derivados";
import { PIE_DESCRIPCION_RESPALDO, datosLocalRespaldo } from "@/lib/contenido/local-respaldo";

/**
 * Datos de la tienda que vienen del contenido editable (D1) y que usan los
 * componentes del navegador: pie, botón flotante de WhatsApp, checkout.
 * El layout (servidor) los lee con respaldo en código y los pasa acá. Sin
 * proveedor (o en pruebas) el valor por defecto es el respaldo.
 */
export interface TiendaContexto {
  local: VistaLocal;
  pieDescripcion: string;
}

const porDefecto: TiendaContexto = { local: vistaLocal(datosLocalRespaldo()), pieDescripcion: PIE_DESCRIPCION_RESPALDO };
const Contexto = createContext<TiendaContexto>(porDefecto);

export function TiendaProvider({ valor, children }: { valor: TiendaContexto; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTienda(): TiendaContexto {
  return useContext(Contexto);
}

export function useLocal(): VistaLocal {
  return useContext(Contexto).local;
}
