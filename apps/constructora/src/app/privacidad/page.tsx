import Link from "next/link";
import { LEGAL_INFO, buildPageMetadata } from "@jurmaq/shared/seo";

// Ejemplo de uso de `buildPageMetadata`: page legal estándar. El helper
// genera canonical, OG y twitter consistentes con la marca constructora.
export const metadata = buildPageMetadata({
  brand: "constructora",
  title: "Politica de Privacidad | Constructora Jorge Ubilla Rivera E.I.R.L.",
  description:
    "Politica de privacidad y proteccion de datos personales de JURMAQ.cl. Informacion sobre recopilacion, uso y resguardo de datos conforme a la ley chilena 19.628.",
  path: "/privacidad",
});

export default function PrivacidadPage() {
  return (
    <>
      {/* Hero Header */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
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
            <span className="text-gray-300">Politica de Privacidad</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
            Politica de Privacidad
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Ultima actualizacion: Abril 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-10 space-y-8">
            {/* 1. Introduccion */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                1. Introduccion
              </h2>
              <p className="text-gray-700 leading-relaxed">
                <strong>Constructora Jorge Ubilla Rivera E.I.R.L.</strong>, con domicilio en{" "}
                {LEGAL_INFO.brands.constructora.direccion}, {LEGAL_INFO.brands.constructora.addressRegion}, Chile, se
                compromete a proteger la privacidad y los datos personales de
                los usuarios de su sitio web{" "}
                <strong>jurmaq.cl</strong>. La presente Politica de Privacidad
                describe como recopilamos, utilizamos, almacenamos y protegemos
                su informacion personal, en conformidad con la Ley N 19.628
                sobre Proteccion de la Vida Privada.
              </p>
            </div>

            {/* 2. Datos que recopilamos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                2. Datos personales que recopilamos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Recopilamos informacion personal cuando usted interactua con
                nuestro sitio web, incluyendo:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  <strong>Datos de identificacion:</strong> Nombre completo, RUT,
                  razon social (en caso de empresas).
                </li>
                <li>
                  <strong>Datos de contacto:</strong> Correo electronico, numero
                  de telefono, direccion de despacho.
                </li>
                <li>
                  <strong>Datos de la transaccion:</strong> Productos
                  cotizados o comprados, montos, metodo de pago utilizado.
                </li>
                <li>
                  <strong>Datos de navegacion:</strong> Direccion IP, tipo de
                  navegador, paginas visitadas, tiempo de permanencia en el
                  sitio.
                </li>
              </ul>
            </div>

            {/* 3. Finalidad del tratamiento */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                3. Finalidad del tratamiento de datos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Los datos personales recopilados son utilizados para las
                siguientes finalidades:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  Procesar cotizaciones, pedidos y despacho de productos.
                </li>
                <li>
                  Gestionar su cuenta de usuario en la Barraca JURMAQ.
                </li>
                <li>
                  Comunicarnos con usted respecto a sus compras, consultas o
                  solicitudes de servicio.
                </li>
                <li>
                  Enviar informacion comercial y promocional (solo si usted ha
                  dado su consentimiento expreso).
                </li>
                <li>
                  Mejorar la experiencia de navegacion y el funcionamiento del
                  sitio web.
                </li>
                <li>
                  Cumplir con obligaciones legales y tributarias vigentes en
                  Chile.
                </li>
              </ul>
            </div>

            {/* 4. Uso de cookies */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                4. Uso de cookies
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Nuestro sitio web utiliza cookies y tecnologias similares para:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  <strong>Cookies esenciales de sesion y preferencias:</strong>{" "}
                  Necesarias para el funcionamiento basico del sitio, como
                  mantener la sesion del usuario, el carrito de compras y las
                  preferencias de navegacion.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Usted puede configurar su navegador para rechazar cookies o
                recibir una notificacion cuando se envien. Sin embargo, algunas
                funcionalidades del sitio pueden verse afectadas.
              </p>
            </div>

            {/* 5. Comparticion de datos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                5. Comparticion de datos con terceros
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ no vende, alquila ni comparte sus datos personales con
                terceros, salvo con los proveedores de servicios estrictamente
                necesarios para la operacion del sitio y el cumplimiento de
                nuestras obligaciones:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  <strong>Supabase:</strong> Proveedor de base de datos y
                  almacenamiento donde se resguardan las cuentas de usuario,
                  cotizaciones y registros transaccionales.
                </li>
                <li>
                  <strong>Vercel:</strong> Proveedor de hosting y entrega del
                  sitio web.
                </li>
                <li>
                  <strong>Resend:</strong> Proveedor de correo transaccional
                  para enviar confirmaciones de cotización, notificaciones de
                  cuenta y comunicaciones de servicio.
                </li>
                <li>
                  <strong>MercadoPago:</strong> Para el procesamiento de pagos
                  en linea. Solo se comparten los datos necesarios para
                  completar la transaccion, sujetos a la politica de privacidad
                  de MercadoPago.
                </li>
                <li>
                  <strong>Empresas de transporte:</strong> Nombre, direccion y
                  telefono para coordinar el despacho de productos.
                </li>
                <li>
                  <strong>Obligaciones legales:</strong> Cuando sea requerido por
                  ley, orden judicial o autoridad competente.
                </li>
              </ul>

              <h3 className="text-base font-bold text-navy-950 mt-6 mb-2">
                Transferencia internacional de datos
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Algunos de estos proveedores tienen servidores fuera de Chile
                (EE.UU., UE, Argentina). Al utilizar el sitio y enviar sus
                datos, usted otorga su consentimiento informado para esta
                transferencia internacional, la cual se realiza bajo estandares
                tecnicos de seguridad equivalentes a los exigidos por la
                legislacion chilena.
              </p>
            </div>

            {/* 6. Retencion de datos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                6. Retencion de datos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Los datos personales seran conservados durante el tiempo
                necesario para cumplir con las finalidades descritas en esta
                politica y conforme a las obligaciones legales y tributarias
                aplicables en Chile. Los datos de transacciones se conservan por
                un periodo minimo de seis (6) anos conforme a la normativa
                tributaria chilena. Los datos de cuentas de usuario se conservan
                mientras la cuenta permanezca activa.
              </p>
            </div>

            {/* 7. Derechos del titular */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                7. Derechos del titular de los datos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                De acuerdo con la Ley N 19.628 sobre Proteccion de la Vida
                Privada, usted tiene derecho a:
              </p>
              <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
                <li>
                  <strong>Acceso:</strong> Solicitar informacion sobre los datos
                  personales que tenemos almacenados sobre usted.
                </li>
                <li>
                  <strong>Rectificacion:</strong> Solicitar la correccion de
                  datos personales inexactos o desactualizados.
                </li>
                <li>
                  <strong>Cancelacion:</strong> Solicitar la eliminacion de sus
                  datos personales cuando ya no sean necesarios para los fines
                  para los cuales fueron recopilados.
                </li>
                <li>
                  <strong>Oposicion:</strong> Oponerse al tratamiento de sus
                  datos personales para fines de marketing directo.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Para ejercer cualquiera de estos derechos, envie un correo
                electronico a{" "}
                <a
                  href="mailto:contacto@jurmaq.cl"
                  className="text-gold-600 hover:underline"
                >
                  contacto@jurmaq.cl
                </a>{" "}
                indicando su solicitud. Responderemos en un plazo maximo de
                quince (15) dias habiles.
              </p>
            </div>

            {/* 8. Seguridad de los datos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                8. Seguridad de los datos
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ implementa medidas tecnicas y organizativas razonables
                para proteger sus datos personales contra el acceso no
                autorizado, perdida, alteracion o destruccion. Nuestro sitio
                web utiliza protocolo HTTPS para la transmision segura de datos.
                No obstante, ningun sistema de transmision o almacenamiento
                electronico es completamente seguro, por lo que no podemos
                garantizar su seguridad absoluta.
              </p>
            </div>

            {/* 9. Menores de edad */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                9. Menores de edad
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Nuestro sitio web y servicios no estan dirigidos a menores de 18
                anos. No recopilamos intencionalmente datos personales de
                menores. Si detectamos que hemos recopilado datos de un menor
                sin el consentimiento de su representante legal, procederemos a
                eliminarlos.
              </p>
            </div>

            {/* 10. Modificaciones */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                10. Modificaciones a esta politica
              </h2>
              <p className="text-gray-700 leading-relaxed">
                JURMAQ se reserva el derecho de modificar la presente Politica
                de Privacidad en cualquier momento. Las modificaciones seran
                publicadas en esta misma pagina con la fecha de actualizacion
                correspondiente. El uso continuado del sitio web despues de
                cualquier cambio constituye la aceptacion de la politica
                modificada.
              </p>
            </div>

            {/* 11. Contacto */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                11. Contacto
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Si tiene consultas, comentarios o solicitudes relacionadas con
                esta Politica de Privacidad o el tratamiento de sus datos
                personales, puede comunicarse con nosotros:
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
                  <strong>Direccion:</strong> {LEGAL_INFO.brands.constructora.direccion}, Chile
                </li>
              </ul>
            </div>

            {/* 12. Encargado de Proteccion de Datos */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                12. Encargado de Proteccion de Datos (DPO)
              </h2>
              <p className="text-gray-700 leading-relaxed">
                En cumplimiento con la Ley N&deg; 21.719 (que entrara en
                vigencia en diciembre de 2026 y moderniza el regimen de datos
                personales en Chile), hemos designado a Jorge Ubilla Rivera
                como Encargado de Proteccion de Datos. Toda comunicacion
                relacionada con derechos ARCO (acceso, rectificacion,
                cancelacion, oposicion), portabilidad o solicitudes de
                eliminacion debe dirigirse a:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                <li>
                  <strong>Email DPO:</strong>{" "}
                  <a href="mailto:contacto@jurmaq.cl" className="text-gold-600 hover:underline">
                    contacto@jurmaq.cl
                  </a>{" "}
                  (asunto: &ldquo;DPO - Solicitud de derechos&rdquo;)
                </li>
                <li>
                  Plazo de respuesta: hasta 15 dias habiles.
                </li>
              </ul>
            </div>

            {/* 13. Notificacion de brechas de seguridad */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                13. Notificacion de brechas de seguridad
              </h2>
              <p className="text-gray-700 leading-relaxed">
                En caso de detectar una vulneracion de seguridad que afecte
                datos personales, notificaremos a los titulares afectados y
                a la autoridad correspondiente dentro de las{" "}
                <strong>72 horas</strong> de tomado conocimiento, conforme a
                lo dispuesto por la Ley N&deg; 21.719. La notificacion
                incluira la naturaleza de los datos comprometidos, las
                medidas adoptadas para mitigar el incidente y las
                recomendaciones para que el titular pueda proteger su
                informacion.
              </p>
            </div>

            {/* 14. Sub-procesadores y transferencias internacionales */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                14. Sub-procesadores y transferencias internacionales
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Para entregar el servicio, JURMAQ utiliza los siguientes
                sub-procesadores tecnologicos. Cada uno cuenta con
                certificaciones de seguridad reconocidas internacionalmente y
                ha firmado Acuerdos de Procesamiento de Datos (DPA)
                equivalentes:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700 list-disc pl-6">
                <li>
                  <strong>Vercel Inc.</strong> (hosting de la aplicacion web,
                  EE.UU.) - SOC 2 Type II.
                </li>
                <li>
                  <strong>Supabase</strong> (base de datos y storage de
                  archivos, EE.UU.) - SOC 2 Type II, HIPAA.
                </li>
                <li>
                  <strong>Resend</strong> (envio de correos
                  transaccionales, EE.UU.) - SOC 2 Type II.
                </li>
                <li>
                  <strong>MercadoPago</strong> (procesamiento de pagos,
                  Argentina/Chile) - PCI DSS Nivel 1. JURMAQ no almacena
                  datos de tarjetas; el procesamiento es directo entre el
                  cliente y MercadoPago.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Algunos sub-procesadores tienen sus servidores fuera de
                Chile. Al usar el servicio, usted consiente esta
                transferencia internacional, la cual se realiza bajo
                estandares contractuales que garantizan un nivel de
                proteccion adecuado.
              </p>
            </div>

            {/* 15. Firma electronica simple (Ley 19.799) */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                15. Firma electronica simple en contratos
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Cuando un arrendatario firma electronicamente un contrato de
                arriendo de maquinaria, JURMAQ utiliza el mecanismo de firma
                electronica simple regulado por la{" "}
                <strong>Ley N&deg; 19.799</strong>. Para garantizar la
                integridad y validez de la firma, capturamos y almacenamos
                el siguiente paquete de evidencia:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700 list-disc pl-6">
                <li>Codigo OTP de 6 digitos enviado al correo electronico o WhatsApp del firmante.</li>
                <li>Direccion IP desde donde se realiza la firma.</li>
                <li>Marca de tiempo (timestamp) en formato ISO-8601 UTC.</li>
                <li>User-Agent del navegador.</li>
                <li>Imagen de la firma manuscrita digital (canvas).</li>
                <li>Hash SHA-256 del documento firmado y del paquete de evidencia.</li>
                <li>
                  Imagen de cedula de identidad (anverso). <strong>Retencion limitada:</strong>{" "}
                  conforme al principio de minimizacion de la Ley N&deg; 19.628, la imagen de la
                  cedula se elimina automaticamente de nuestros sistemas a los <strong>90 dias</strong>{" "}
                  contados desde la firma del contrato. Se mantiene unicamente un hash criptografico
                  (SHA-256) que NO permite reconstruir la imagen y que forma parte de la cadena de
                  evidencia que valida la firma electronica.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                El paquete de evidencia (excepto la imagen de cedula segun se indica arriba)
                se conserva mientras dure la relacion contractual y por al menos 6 anos
                adicionales tras su termino, segun lo exigido por el Codigo Tributario y la
                normativa contable aplicable.
              </p>
            </div>

            {/* 16. Cumplimiento normativo */}
            <div>
              <h2 className="text-xl font-bold text-navy-950 mb-3">
                16. Cumplimiento normativo
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Esta Politica de Privacidad se rige por la legislacion
                chilena, especialmente por:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-700 list-disc pl-6">
                <li><strong>Ley N&deg; 19.628</strong> sobre Proteccion de la Vida Privada (vigente).</li>
                <li><strong>Ley N&deg; 21.719</strong> sobre Datos Personales (vigente desde diciembre de 2026 - GDPR-style).</li>
                <li><strong>Ley N&deg; 19.799</strong> sobre Documentos Electronicos y Firma Electronica.</li>
                <li><strong>Ley N&deg; 19.496</strong> sobre Derechos del Consumidor (Sernac).</li>
                <li><strong>Ley N&deg; 21.521 (Fintec)</strong> en lo aplicable a procesamiento de pagos.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
