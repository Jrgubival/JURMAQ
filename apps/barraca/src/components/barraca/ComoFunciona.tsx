/**
 * "Cómo funciona": tres pasos para mejorar una cotización, al modo de una
 * tienda (Sodimac, Easy), no de una revista. Fondo blanco, una sola fuente,
 * título como el de las demás filas de la portada, número en círculo rojo de
 * marca y un botón de WhatsApp con el verde que ya usa el sitio.
 *
 * Sin plazos ni promesas nuevas: los pasos dicen lo que pasa, no cuánto tarda.
 * Se usa en la portada y en /te-mejoramos-el-precio.
 */

const PASOS = [
  { t: "Mándanos tu cotización por WhatsApp", d: "Sirve una foto, una captura o el PDF." },
  { t: "La revisamos", d: "" },
  { t: "Te respondemos con nuestra oferta y el despacho", d: "" },
];

export default function ComoFunciona({
  whatsappHref,
  nota,
  className = "",
  ancho = "max-w-7xl",
}: {
  /** URL completa de wa.me con el texto ya pre-llenado. */
  whatsappHref: string;
  /** Línea visible junto al botón (opcional). */
  nota?: string;
  className?: string;
  /** Ancho del contenedor, para alinear con el resto de la página. */
  ancho?: "max-w-7xl" | "max-w-6xl";
}) {
  return (
    <section aria-labelledby="como-funciona-titulo" className={`bg-white ${className}`}>
      <div className={`${ancho} mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16`}>
        <h2 id="como-funciona-titulo" className="text-2xl font-extrabold text-navy-950 mb-8">
          Cómo funciona
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PASOS.map((p, i) => (
            <li key={p.t} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="w-9 h-9 shrink-0 rounded-full bg-marca-600 text-white text-base font-bold flex items-center justify-center tabular-nums"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-1.5">
                <p className="text-base font-bold text-navy-950 leading-snug">
                  <span className="sr-only">Paso {i + 1}: </span>
                  {p.t}
                </p>
                {p.d && <p className="text-sm text-gray-500 mt-1">{p.d}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Mandar mi cotización por WhatsApp
          </a>
          {nota && <p className="text-sm text-gray-500">{nota}</p>}
        </div>
      </div>
    </section>
  );
}
