"use client";

import { useEffect, useRef } from "react";
import { formatCLP } from "@jurmaq/shared/format";

/** Envía solo el formulario a Webpay; si el navegador no lo hace, queda el botón. */
export default function IrAWebpay({ accion, token, total }: { accion: string; token: string; total: number }) {
  const form = useRef<HTMLFormElement>(null);
  const enviado = useRef(false);
  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    form.current?.submit();
  }, []);

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <span className="inline-block w-8 h-8 border-[3px] border-gray-300 border-t-navy-950 rounded-full animate-spin mb-6" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-navy-950 mb-2">Te llevamos a Webpay</h1>
      <p className="text-sm text-gray-600 mb-6">
        Vas a pagar <strong className="tabular-nums">{formatCLP(total)}</strong> en el sitio seguro de Transbank.
      </p>
      <form ref={form} action={accion} method="POST">
        <input type="hidden" name="token_ws" value={token} />
        <button type="submit" className="min-h-[44px] px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold">
          Ir a Webpay
        </button>
      </form>
    </div>
  );
}
