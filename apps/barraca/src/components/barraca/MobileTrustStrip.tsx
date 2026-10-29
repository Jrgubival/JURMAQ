import Link from "@/components/barraca/Enlace";
import Revelar from "./Revelar";

/**
 * Franja marina "Así te llega": tres hechos de la compra (retiro, despacho,
 * pago), en celular y escritorio. Sólo dice lo que la tienda hace hoy: no
 * promete plazos de entrega mientras no estén las tarifas de despacho.
 */
export default function MobileTrustStrip() {
  const items = [
    {
      title: "Retiro en Molina",
      sub: "Pagas en línea y lo retiras en Av. Poniente 2157.",
      icon: "M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      title: "Despacho a tu obra",
      sub: "Te llamamos para coordinar día y hora de entrega.",
      icon: "M3 8a2 2 0 012-2h7v10H5a2 2 0 01-2-2V8zm9-2h4l3 4v4a2 2 0 01-2 2h-5V6zM7 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z",
    },
    {
      title: "Pago seguro",
      sub: "Mercado Pago o transferencia. Boleta o factura.",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    },
  ];

  return (
    <section aria-labelledby="asi-te-llega" className="fondo-marino text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex items-end justify-between gap-4 mb-6 lg:mb-8">
          <h2 id="asi-te-llega" className="text-xl lg:text-2xl font-extrabold leading-tight">
            Tú compras en línea.<br className="sm:hidden" /> Nosotros lo preparamos.
          </h2>
          <Link href="/sucursales" className="hidden sm:inline text-sm font-semibold text-white/80 hover:text-white shrink-0">
            Horarios y dirección
          </Link>
        </div>
        <Revelar className="grid gap-3 sm:grid-cols-3 lg:gap-4">
          {items.map((it) => (
            <div
              key={it.title}
              data-revelar
              className="flex items-start gap-3.5 rounded-xl bg-white/[0.06] border border-white/10 p-4"
            >
              <div className="w-10 h-10 rounded-lg bg-marca-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={it.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-tight">{it.title}</p>
                <p className="text-sm text-white/70 leading-snug mt-1">{it.sub}</p>
              </div>
            </div>
          ))}
        </Revelar>
      </div>
    </section>
  );
}
