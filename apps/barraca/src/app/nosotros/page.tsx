import type { Metadata } from 'next';
import Link from '@/components/barraca/Enlace';
import { LEGAL_INFO } from '@jurmaq/shared/seo';
import { LUGARES_DESPACHO } from '@/lib/cobertura';

/**
 * /nosotros — quiénes somos, sólo con datos verificables del negocio (sin
 * años de trayectoria, premios ni "los mejores precios" que no se puedan
 * respaldar: Google Merchant Center los trata como afirmaciones engañosas).
 */
const B = LEGAL_INFO.brands.barraca;

export const metadata: Metadata = {
  title: 'Quiénes somos · Barraca de Fierros JURMAQ, Molina',
  description: `${B.razonSocial}: barraca de fierros y materiales de construcción en Av. Poniente 2157, Molina. Venta en el local y en línea, retiro en Molina y despacho en camión propio.`,
  alternates: { canonical: 'https://barraca.jurmaq.cl/nosotros' },
};

export default function NosotrosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-[16px] leading-relaxed text-[#37352F]">
      <h1 className="text-3xl font-bold text-navy-950 mb-6">Quiénes somos</h1>
      <p className="mb-4">
        Somos <strong>{B.razonSocial}</strong> (RUT {B.rut}), una barraca de fierros y materiales de construcción con local
        en <strong>Av. Poniente 2157, Molina</strong>, Región del Maule.
      </p>
      <p className="mb-4">
        Vendemos fierro de construcción, perfiles, planchas, tubos, mallas, techumbre, herramientas, pinturas y materiales de obra,
        para particulares, maestros y empresas. Las empresas pueden pedir factura.
      </p>
      <p className="mb-4">
        Puedes comprar en el local o en esta tienda en línea, con el precio y el stock de nuestra bodega. Retiras gratis en Molina
        o te lo llevamos en nuestro camión a {LUGARES_DESPACHO}.
      </p>
      <p className="mb-8">
        Pagas con tarjeta de débito o crédito en Webpay (Transbank) o por transferencia bancaria a la cuenta de la empresa.
      </p>
      <p className="text-[15px]">
        <Link href="/contacto" className="text-navy-950 font-medium underline underline-offset-2">Contacto y horario</Link> ·{' '}
        <Link href="/envios-y-devoluciones" className="text-navy-950 underline underline-offset-2">Envíos y devoluciones</Link> ·{' '}
        <Link href="/terminos" className="text-navy-950 underline underline-offset-2">Términos y condiciones</Link>
      </p>
    </div>
  );
}
