"use client";

import { createContext, useContext } from "react";

/**
 * ¿Está activo Webpay? Lo decide el servidor (lib/pagos, pagoEnLineaDisponible)
 * en el layout raíz y lo comparte con los componentes del navegador, para
 * mostrar las cuotas sin interés sólo cuando se puede pagar con tarjeta.
 */
const PagoEnLineaContexto = createContext(false);

export function PagoEnLineaProvider({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  return <PagoEnLineaContexto.Provider value={activo}>{children}</PagoEnLineaContexto.Provider>;
}

export function usePagoEnLinea(): boolean {
  return useContext(PagoEnLineaContexto);
}
