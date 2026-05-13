import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terminos y Condiciones | Constructora Jorge Ubilla Rivera E.I.R.L.",
  description:
    "Terminos y condiciones de uso del sitio web JURMAQ.cl. Condiciones de venta, despacho, garantias y politicas comerciales de Constructora Jorge Ubilla Rivera E.I.R.L., Molina, Maule, Chile.",
  alternates: {
    canonical: "https://jurmaq.cl/terminos",
  },
  openGraph: {
    title: "Terminos y Condiciones | JURMAQ.cl",
    description:
      "Terminos y condiciones de uso, venta y despacho de Constructora Jorge Ubilla Rivera E.I.R.L.",
    url: "https://jurmaq.cl/terminos",
    siteName: "JURMAQ.cl",
    locale: "es_CL",
    type: "website",
  },
};

export default function TerminosPage() {
  return (
    <>
      {/* Hero Header */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/" className="hover:text-gold-500 transition-colors">
              Inicio
            </Link>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-gray-300">Terminos y Condiciones</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
            Terminos y Condiciones
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Ultima actualizacion: Abril 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-10 space-y-8">
            {/* 1. Identificacion de la empresa */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                1. Identificacion de la empresa
              </h2>
              <p className="text-gray-700 leading-relaxed">
                El presente sitio web <strong>jurmaq.cl</strong> es operado por{" "}
                <strong>Constructora Jorge Ubilla Rivera E.I.R.L.</strong>, empresa
                constituida conforme a las leyes de la Republica de Chile, con
                domicilio en Av. Poniente 2157, Molina, Region del Maule,
                Chile.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                <li>
                  <strong>Razon social:</strong> Constructora Jorge Ubilla Rivera E.I.R.L.
                </li>
                <li>
                  <strong>RUT:</strong> 76.624.872-1
                </li>
                <li>
                  <strong>Direccion:</strong> Av. Poniente 2157, Molina, Maule,
                  Chile
                </li>
                <li>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:contacto@jurmaq.cl"
                    className="text-gold-600 hover:underline"
                  >
                    contacto@jurmaq.cl
                  </a>
                </li>
                <li>
                  <strong>Telefono:</strong>{" "}
                  <a
                    href="tel:+56976673577"
                    className="text-gold-600 hover:underline"
                  >
                    +56 9 7667 3577
                  </a>
                </li>
              </ul>
            </div>

            {/* 2. Descripcion de los servicios */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                2. Descripcion de los servicios
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Constructora Jorge Ubilla Rivera E.I.R.L. ofrece los siguientes servicios y
                productos a traves de su sitio web y sus dependencias fisicas:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  Construccion industrial y obras civiles en la Region del
                  Maule.
                </li>
                <li>
                  Arriendo de maquinaria pesada (retroexcavadoras, gruas,
                  camiones, entre otros).
                </li>
                <li>Servicios de maestranza y fabricacion metalica.</li>
                <li>
                  Venta de materiales de construccion a traves de la Barraca
                  JURMAQ (fierros, perfiles, planchas, fijaciones, herramientas,
                  pinturas, electricidad y mas).
                </li>
              </ul>
            </div>

            {/* 3. Aceptacion de los terminos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                3. Aceptacion de los terminos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Al acceder, navegar o utilizar este sitio web, el usuario acepta
                los presentes Terminos y Condiciones en su totalidad. Si no esta
                de acuerdo con alguna de estas condiciones, le solicitamos no
                utilizar el sitio. JURMAQ se reserva el derecho de modificar
                estos terminos en cualquier momento, siendo responsabilidad del
                usuario revisarlos periodicamente.
              </p>
            </div>

            {/* 4. Precios y productos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                4. Precios y productos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Los precios publicados en el sitio web son referenciales y pueden
                variar sin previo aviso. Los precios definitivos seran los
                confirmados al momento de generar la cotizacion o el pedido.
                Todos los precios estan expresados en pesos chilenos (CLP) e
                incluyen IVA salvo que se indique lo contrario. La disponibilidad
                de productos esta sujeta a stock existente.
              </p>
            </div>

            {/* 5. Medios de pago */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                5. Medios de pago
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ acepta los siguientes medios de pago:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  <strong>MercadoPago:</strong> Tarjetas de credito, debito y
                  otros medios disponibles a traves de la plataforma MercadoPago.
                </li>
                <li>
                  <strong>Transferencia bancaria:</strong> Transferencia
                  electronica a la cuenta de Constructora Jorge Ubilla Rivera E.I.R.L.
                </li>
                <li>
                  <strong>Efectivo:</strong> Pago en efectivo al momento del
                  retiro en planta o despacho.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                El procesamiento de pagos mediante MercadoPago esta sujeto a los
                terminos y condiciones de dicha plataforma. JURMAQ no almacena
                datos de tarjetas de credito o debito.
              </p>
            </div>

            {/* 6. Despacho y entrega */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                6. Despacho y entrega
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ realiza despachos dentro de la Region del Maule, con
                cobertura principal en la Provincia de Curico (Curico, Teno,
                Molina, Romeral, Sagrada Familia, Hualane, Licanten, Vichuquen y
                Rauco). Los plazos de entrega son estimados y pueden variar segun
                la disponibilidad de stock y la zona de despacho.
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  Envio gratuito en compras sobre $100.000 dentro de la zona de
                  cobertura.
                </li>
                <li>
                  Retiro en planta disponible en Av. Poniente 2157, Molina, en
                  horario de atencion.
                </li>
                <li>
                  Los costos de despacho fuera de la zona de cobertura habitual
                  seran informados al momento de la cotizacion.
                </li>
              </ul>
            </div>

            {/* 7. Garantia y devoluciones */}
            <div id="garantia">
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                7. Garantia y devoluciones
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Todos los productos comercializados por JURMAQ cuentan con la
                garantia legal establecida en la Ley N 19.496 sobre Proteccion
                de los Derechos de los Consumidores (modificada por la Ley N
                21.398). El consumidor tiene derecho a:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  La reposicion del producto, su reparacion gratuita o la
                  devolucion del monto pagado, cuando el producto presente
                  defectos de fabricacion, no sea apto para el uso al que esta
                  destinado o no corresponda a las especificaciones ofrecidas.
                </li>
                <li>
                  <strong>Productos perecibles o no durables:</strong> el plazo
                  para ejercer la garantia legal es de tres (3) meses desde la
                  fecha de recepcion del producto.
                </li>
                <li>
                  <strong>Bienes durables</strong> (herramientas, maquinaria,
                  fierros, perfiles y demas productos de construccion): el plazo
                  para ejercer la garantia legal es de seis (6) meses desde la
                  fecha de recepcion del producto, conforme al articulo 21 de la
                  Ley N 19.496 modificado por la Ley N 21.398, salvo que el
                  fabricante otorgue un plazo superior.
                </li>
                <li>
                  No aplica garantia en casos de uso indebido, desgaste natural,
                  manipulacion incorrecta o modificaciones realizadas por el
                  usuario.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Para gestionar una devolucion o reclamo, el cliente debe
                contactarnos a{" "}
                <a
                  href="mailto:contacto@jurmaq.cl"
                  className="text-gold-600 hover:underline"
                >
                  contacto@jurmaq.cl
                </a>{" "}
                o al telefono{" "}
                <a
                  href="tel:+56976673577"
                  className="text-gold-600 hover:underline"
                >
                  +56 9 7667 3577
                </a>
                , presentando el comprobante de compra correspondiente.
              </p>
            </div>

            {/* 8. Derecho a retracto */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                8. Derecho a retracto
              </h2>
              <p className="text-gray-700 leading-relaxed">
                De acuerdo con la Ley N 19.496, en las compras realizadas a
                traves del sitio web, el consumidor podra ejercer el derecho a
                retracto dentro de los diez (10) dias siguientes a la recepcion
                del producto, siempre que el producto se encuentre en su embalaje
                original, sin uso y en las mismas condiciones en que fue
                recibido.
              </p>
            </div>

            {/* 9. Limitacion de responsabilidad */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                9. Limitacion de responsabilidad
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ no sera responsable por danos directos, indirectos,
                incidentales o consecuentes que puedan derivarse del uso del
                sitio web, incluyendo pero no limitado a: interrupciones del
                servicio, errores en la informacion publicada, virus
                informaticos, o la imposibilidad de acceso al sitio. Las
                imagenes de los productos son referenciales y pueden diferir del
                producto real.
              </p>
            </div>

            {/* 10. Propiedad intelectual */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                10. Propiedad intelectual
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Todo el contenido del sitio web jurmaq.cl, incluyendo pero no
                limitado a textos, graficos, logotipos, imagenes, iconos,
                software y demas material, es propiedad de Constructora JURMAQ
                E.I.R.L. o de sus respectivos titulares y esta protegido por las
                leyes chilenas e internacionales de propiedad intelectual. Queda
                prohibida su reproduccion, distribucion o modificacion sin
                autorizacion previa y por escrito.
              </p>
            </div>

            {/* 11. Legislacion aplicable */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                11. Legislacion aplicable y jurisdiccion
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Los presentes Terminos y Condiciones se rigen por las leyes de la
                Republica de Chile. Cualquier controversia que surja en relacion
                con el uso de este sitio web o la compra de productos y servicios
                sera sometida a los tribunales ordinarios de justicia de la
                ciudad de Curico, Region del Maule, Chile.
              </p>
            </div>

            {/* 12. Reclamos ante SERNAC */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                12. Reclamos ante SERNAC
              </h2>
              <p className="text-gray-700 leading-relaxed">
                El consumidor podra presentar reclamos ante el Servicio Nacional
                del Consumidor (SERNAC) a traves del sitio{" "}
                <a
                  href="https://reclamos.sernac.cl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-600 hover:underline"
                >
                  reclamos.sernac.cl
                </a>
                , sin perjuicio de las acciones judiciales que procedan ante los
                tribunales ordinarios.
              </p>
            </div>

            {/* 13. Contacto */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                13. Contacto
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Para consultas sobre estos Terminos y Condiciones, puede
                comunicarse con nosotros a traves de:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                <li>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:contacto@jurmaq.cl"
                    className="text-gold-600 hover:underline"
                  >
                    contacto@jurmaq.cl
                  </a>
                </li>
                <li>
                  <strong>Telefono:</strong>{" "}
                  <a
                    href="tel:+56976673577"
                    className="text-gold-600 hover:underline"
                  >
                    +56 9 7667 3577
                  </a>
                </li>
                <li>
                  <strong>Direccion:</strong> Av. Poniente 2157, Molina, Maule,
                  Chile
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
