import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContactForm } from "@/components/public/ContactForm";
import { whatsappCtaContacto } from "@jurmaq/shared/whatsapp";

export const metadata: Metadata = {
  title:
    "Contacto y Cotización | Constructora y Maquinaria en Curicó, Maule",
  description:
    "Cotiza sin compromiso para construcción industrial, arriendo de maquinaria pesada, maestranza y barraca de fierros en Curicó, Teno, Molina, Romeral, Sagrada Familia y toda la Provincia de Curicó, Región del Maule, Chile. Constructora Jorge Ubilla Rivera E.I.R.L.",
  keywords: [
    "cotización constructora Curicó",
    "cotización construcción Curicó",
    "cotización maquinaria Curicó",
    "presupuesto construcción Maule",
    "presupuesto construcción Curicó",
    "cotización arriendo maquinaria Curicó",
    "contacto constructora Curicó",
    "contacto JURMAQ",
    "cotización maestranza Curicó",
    "cotización barraca fierros Curicó",
    "presupuesto obra Teno",
    "presupuesto obra Molina",
    "constructora presupuesto Maule",
  ],
  openGraph: {
    title: "Contacto y Cotización | JURMAQ - Constructora en Curicó, Maule",
    description:
      "Cotiza sin compromiso. Construcción industrial, arriendo de maquinaria, maestranza y barraca de fierros en la Provincia de Curicó.",
    url: "https://jurmaq.cl/contacto",
  },
  alternates: {
    canonical: "https://jurmaq.cl/contacto",
  },
};

export default function ContactoPage() {
  return (
    <>
      {/* Hero Header */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div>
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
              <span className="text-gray-300">Contacto</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">
              <span className="text-gold-500">Recibe tu presupuesto hoy mismo</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl">
              Llena el formulario o llámanos directo al{" "}
              <a href="tel:+56976673577" className="text-gold-400 hover:text-gold-300">+56 9 7667 3577</a>
              <span className="block text-sm text-gray-400 mt-1">Respondemos en menos de 2 horas en horario laboral</span>
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
                <h2 className="text-xl font-bold text-navy-950 mb-6">
                  Pedir presupuesto
                </h2>
                <Suspense fallback={<div className="animate-pulse bg-gray-100 rounded-xl h-96" />}>
                  <ContactForm />
                </Suspense>
              </div>
            </div>

            {/* Contact Info Sidebar */}
            <div>
            <div className="space-y-6">
              {/* Contact Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-navy-950 mb-5">
                  Información de contacto
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-navy-950 text-gold-500 rounded-xl shrink-0">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-950">
                        Dirección
                      </p>
                      <p className="text-sm text-gray-600">
                        Av. Poniente 2157
                        <br />
                        Molina, Maule, Chile
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-navy-950 text-gold-500 rounded-xl shrink-0">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-950">
                        Teléfono
                      </p>
                      <a
                        href="tel:+56976673577"
                        className="text-sm text-gray-600 hover:text-gold-600 transition-colors"
                      >
                        +56 9 7667 3577
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-navy-950 text-gold-500 rounded-xl shrink-0">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-950">
                        Email
                      </p>
                      <a
                        href="mailto:contacto@jurmaq.cl"
                        className="text-sm text-gray-600 hover:text-gold-600 transition-colors"
                      >
                        contacto@jurmaq.cl
                      </a>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Hours Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-navy-950 mb-4">
                  Horario de atención
                </h3>
                <ul className="space-y-3">
                  <li className="flex justify-between text-sm">
                    <span className="text-gray-600">Lunes - Viernes</span>
                    <span className="font-semibold text-navy-950">
                      8:30 - 18:30
                    </span>
                  </li>
                  <li className="flex justify-between text-sm">
                    <span className="text-gray-600">Sábado</span>
                    <span className="font-semibold text-navy-950">
                      9:00 - 14:00
                    </span>
                  </li>
                  <li className="flex justify-between text-sm">
                    <span className="text-gray-600">Domingo</span>
                    <span className="text-gray-500">Cerrado</span>
                  </li>
                </ul>
              </div>

              {/* WhatsApp Card */}
              <a
                href={whatsappCtaContacto()}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-green-600 hover:bg-green-700 rounded-2xl p-6 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-white/20 rounded-xl shrink-0">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-bold">
                      Escríbenos por WhatsApp
                    </p>
                    <p className="text-green-100 text-sm">
                      Respuesta inmediata
                    </p>
                  </div>
                </div>
              </a>
            </div>
            </div>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Contacto JURMAQ",
        "url": "https://jurmaq.cl/contacto",
        "mainEntity": {
          "@type": "LocalBusiness",
          "name": "Constructora Jorge Ubilla Rivera E.I.R.L.",
          "telephone": "+56976673577",
          "email": "contacto@jurmaq.cl",
          "address": { "@type": "PostalAddress", "streetAddress": "Av. Poniente 2157", "addressLocality": "Molina", "addressRegion": "Maule", "addressCountry": "CL" }
        }
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://jurmaq.cl" },
          { "@type": "ListItem", "position": 2, "name": "Contacto", "item": "https://jurmaq.cl/contacto" }
        ]
      })}} />
    </>
  );
}
