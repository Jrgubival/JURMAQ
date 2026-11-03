import type { Metadata } from 'next';
import Link from '@/components/barraca/Enlace';
import { formatCLP } from '@jurmaq/shared/format';
import { zonasDespachoVigentes } from '@/lib/despacho/tarifas-db';

/**
 * /envios-y-devoluciones — resumen claro de las políticas de despacho,
 * retiro, devoluciones y reembolsos. El texto que obliga es el de los
 * Términos (secciones 9, 11 y 12); acá se resume y se enlaza. Las tarifas
 * salen de la misma tabla que cobra el checkout (panel → Despacho).
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Envíos y devoluciones · Barraca JURMAQ',
  description: 'Retiro gratis en Molina y despacho en camión propio con tarifa por zona (Molina gratis). Devoluciones dentro de 10 días corridos y reembolsos según los Términos.',
  alternates: { canonical: 'https://barraca.jurmaq.cl/envios-y-devoluciones' },
};

const h2 = 'text-xl font-bold text-navy-950 mt-10 mb-3';

export default async function EnviosPage() {
  const { zonas } = await zonasDespachoVigentes();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-[16px] leading-relaxed text-[#37352F]">
      <h1 className="text-3xl font-bold text-navy-950 mb-4">Envíos y devoluciones</h1>
      <p>Resumen de cómo entregamos y cómo devolver. El detalle está en los <Link href="/terminos" className="underline underline-offset-2">Términos y condiciones</Link>.</p>

      <h2 className={h2}>Retiro en el local</h2>
      <p>Gratis, en Av. Poniente 2157, Molina, en horario de atención. Te avisamos cuando el pedido esté listo.</p>

      <h2 className={h2}>Despacho en camión</h2>
      <p className="mb-4">
        Preparamos el pedido en 1 a 5 días hábiles y te llamamos para coordinar el día de entrega. Despachamos a estas zonas, con
        el costo que ves en el checkout antes de pagar:
      </p>
      <div className="rounded-xl border border-[#EAEAEA] bg-white overflow-hidden">
        <table className="w-full text-[15px]">
          <thead className="bg-[#F7F7F5] text-left text-[13px] text-[#787774]">
            <tr><th className="px-4 py-2 font-medium">Zona</th><th className="px-4 py-2 font-medium text-right">Despacho</th></tr>
          </thead>
          <tbody>
            {zonas.map((z) => (
              <tr key={z.id} className="border-t border-[#EAEAEA]">
                <td className="px-4 py-2">{z.nombre}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {z.costo === 0 ? 'Gratis' : formatCLP(z.costo)}
                  {z.costo > 0 && z.gratisDesde != null && <span className="block text-[12px] text-[#787774]">gratis desde {formatCLP(z.gratisDesde)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[14px] text-[#5A5A57]">Para otras comunas, escríbenos por WhatsApp y te cotizamos, o retira en Molina.</p>

      <h2 className={h2}>Devoluciones (derecho a retracto)</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Puedes arrepentirte dentro de <strong>10 días corridos</strong> desde que recibes o retiras el producto, sin dar una razón.</li>
        <li>Lo devuelves en el local de Molina o, dentro de nuestras zonas de despacho, lo retiramos sin costo para ti.</li>
        <li>El producto tiene que estar sin uso ni deterioro (los materiales de acero, sin cortes, soldaduras ni pintura).</li>
        <li>No tienen retracto los productos abiertos, usados o instalados que no se pueden volver a vender (por ejemplo, cemento o pintura abiertos), ni los cortados a medida. Te lo advertimos antes de pagar.</li>
      </ul>

      <h2 className={h2}>Reembolsos</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Webpay: anulamos el cargo en la misma tarjeta. El abono depende de tu banco o emisor.</li>
        <li>Transferencia: te transferimos a la cuenta que nos indiques, de la que seas titular.</li>
        <li>Lo hacemos lo antes posible: si no podemos cumplir un pedido, a más tardar en 10 días hábiles; en el retracto, dentro del plazo legal. Sin cargos ni comisiones.</li>
      </ul>

      <p className="mt-10 text-[15px]">
        ¿Dudas? <Link href="/contacto" className="text-navy-950 font-medium underline underline-offset-2">Contacto</Link> ·{' '}
        <Link href="/terminos#11-derecho-de-retracto-arrepentimiento" className="underline underline-offset-2">Términos 11 (retracto)</Link> ·{' '}
        <Link href="/terminos#12-devoluciones-y-reembolsos" className="underline underline-offset-2">Términos 12 (reembolsos)</Link>
      </p>
    </div>
  );
}
