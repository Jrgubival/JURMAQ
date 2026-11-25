import { metaPaginaDefecto, localParaMeta } from "@/lib/seo-editable/defecto";
import { metaConSeo } from "@/lib/seo-editable/lectura";
import type { Metadata } from 'next';
import Link from '@/components/barraca/Enlace';
import { LUGARES_DESPACHO } from '@/lib/cobertura';
import { leerContenidoConOrigen, leerLocal } from '@/lib/contenido/lectura';
import { sustituirMarcadores, valoresDeMarcadores } from '@/lib/contenido/marcadores';
import { renderizar } from '@/components/barraca/DocumentoLegal';

/**
 * /nosotros — quiénes somos, sólo con datos verificables del negocio (sin
 * años de trayectoria, premios ni "los mejores precios" que no se puedan
 * respaldar: Google Merchant Center los trata como afirmaciones engañosas).
 *
 * El texto sale del contenido editable (D1); si no hay nada publicado o D1
 * falla, se muestra el de código (idéntico al de siempre). Los datos del local
 * (razón social, RUT, dirección) salen de la fuente única de datos del local.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const B = await leerLocal();
  const textos = metaPaginaDefecto('nosotros', localParaMeta(B));
  return metaConSeo<Metadata>('pagina', 'nosotros', {
    title: textos.titulo,
    description: textos.descripcion,
    alternates: { canonical: 'https://barraca.jurmaq.cl/nosotros' },
  });
}

const CONTENEDOR = 'max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-[16px] leading-relaxed text-[#37352F]';

export default async function NosotrosPage() {
  const [B, { valor, origen }] = await Promise.all([leerLocal(), leerContenidoConOrigen('nosotros')]);
  const enlaces = (
    <p className="text-[15px]">
      <Link href="/contacto" className="text-navy-950 font-medium underline underline-offset-2">Contacto y horario</Link> ·{' '}
      <Link href="/envios-y-devoluciones" className="text-navy-950 underline underline-offset-2">Envíos y devoluciones</Link> ·{' '}
      <Link href="/terminos" className="text-navy-950 underline underline-offset-2">Términos y condiciones</Link>
    </p>
  );
  if (origen === 'd1') {
    const md = sustituirMarcadores(valor.texto, valoresDeMarcadores(B, { lugaresDespacho: LUGARES_DESPACHO }));
    return (
      <div className={CONTENEDOR}>
        {renderizar(md, 'pagina')}
        <div className="mt-8">{enlaces}</div>
      </div>
    );
  }
  return (
    <div className={CONTENEDOR}>
      <h1 className="text-3xl font-bold text-navy-950 mb-6">Quiénes somos</h1>
      <p className="mb-4">
        Somos <strong>{B.razonSocial}</strong> (RUT {B.rut}), una barraca de fierros y materiales de construcción con local
        en <strong>{B.direccionCorta}</strong>, Región del Maule.
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
      {enlaces}
    </div>
  );
}
