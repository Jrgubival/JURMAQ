import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * /roadmap — Roadmap público de JURMAQ.
 *
 * Diferenciador: ningún competidor (Sodimac, Easy, Construmart, Prodalam) tiene
 * roadmap público. Mostrar qué viene es ULTRA transparente — genera confianza,
 * permite a clientes B2B planificar, y nos hace ver más serios que las big-box.
 */

export const metadata: Metadata = {
  title: 'Roadmap público · JURMAQ',
  description:
    'Qué estamos construyendo en JURMAQ Barraca y Arriendo. Lista pública de features en desarrollo, próximas a lanzar y completadas. Transparencia total.',
  alternates: { canonical: 'https://barraca.jurmaq.cl/roadmap' },
};

type Estado = 'done' | 'shipping' | 'planned' | 'considering';

interface Item {
  titulo: string;
  descripcion: string;
  area: 'barraca' | 'arriendo' | 'general';
  estado: Estado;
  eta?: string;
}

const ITEMS: Item[] = [
  // ✅ DONE
  { titulo: 'Catálogo +1.600 productos barraca', descripcion: 'Fierros, fijaciones, herramientas, pinturas, electricidad y más. 17 categorías con filtros y búsqueda.', area: 'barraca', estado: 'done' },
  { titulo: 'Reviews y ratings de productos', descripcion: 'Clientes pueden dejar reviews 1-5 estrellas con comentario. Útil al elegir.', area: 'barraca', estado: 'done' },
  { titulo: 'Cupones de descuento', descripcion: 'Códigos promo aplicables en carrito. Por categoría o monto fijo.', area: 'barraca', estado: 'done' },
  { titulo: 'Carrito abandonado recovery', descripcion: 'Recuperación automática por email a las 1h, 24h y 72h. Y SMS a los 15 min.', area: 'barraca', estado: 'done' },
  { titulo: 'Maestros referidos con 1% comisión', descripcion: 'Programa de afiliados único en Chile. Cada maestro tiene código MAE-YYYY-NNN y gana por obras referidas.', area: 'barraca', estado: 'done' },
  { titulo: 'Ranking público de maestros', descripcion: 'Página /maestros con leaderboard de los top 20.', area: 'barraca', estado: 'done' },
  { titulo: 'Calculadoras técnicas', descripcion: 'Cemento, pintura, fierro, hormigón, zincalum. Para presupuestar tu obra.', area: 'barraca', estado: 'done' },
  { titulo: 'Te mejoramos el precio', descripcion: 'Sube cotización rival, te respondemos con mejor precio en menos de 2 horas.', area: 'barraca', estado: 'done' },
  { titulo: 'Catálogo de maquinaria arriendo', descripcion: 'Retro, mini, brazos, grúas, camiones y rodillos con disponibilidad en vivo.', area: 'arriendo', estado: 'done' },
  { titulo: 'Pricing día/semana/mes', descripcion: 'Tarifas claras por período con descuento automático. IVA incluido.', area: 'arriendo', estado: 'done' },
  { titulo: 'Cómo funciona el arriendo', descripcion: 'Página /como-funciona con proceso paso a paso y FAQ.', area: 'arriendo', estado: 'done' },
  { titulo: 'Calendario disponibilidad en vivo', descripcion: 'Próximos 30 días con bloqueos reales.', area: 'arriendo', estado: 'done' },
  { titulo: 'OTP firma de contratos', descripcion: 'Firma digital con código por WhatsApp + email.', area: 'arriendo', estado: 'done' },

  // 🟡 SHIPPING (próximas 2-4 semanas)
  { titulo: 'WhatsApp-first checkout', descripcion: 'Comprar por WhatsApp como flujo principal. Sin signup obligatorio.', area: 'barraca', estado: 'shipping', eta: 'Próximas semanas' },
  { titulo: 'Branch selector en header', descripcion: 'Elige tu sucursal (Curicó/Molina/Talca/Linares) y ve stock real.', area: 'barraca', estado: 'shipping', eta: 'Próximas semanas' },
  { titulo: 'Stock por sucursal en producto', descripcion: 'Cada ProductCard muestra cuántos hay disponibles en tu sucursal.', area: 'barraca', estado: 'shipping', eta: 'Próximas semanas' },
  { titulo: 'Sucursales página pública', descripcion: 'Mapa, horarios, WhatsApp directo por sucursal.', area: 'general', estado: 'done' },
  { titulo: 'Cross-sell maquinaria ↔ barraca', descripcion: 'Si arriendas retro, te ofrecemos los fierros que vas a usar.', area: 'general', estado: 'shipping', eta: 'Próximas semanas' },
  { titulo: 'Proyectos / Obras destacadas', descripcion: 'Casos reales con video, materiales y máquinas usadas. Prueba social + inspiración.', area: 'general', estado: 'shipping', eta: 'Junio 2026' },

  // 🔵 PLANNED (1-3 meses)
  { titulo: 'Calcula tu obra completa', descripcion: 'Wizard: tipo obra (galpón/casa/piscina) + dimensiones → lista materiales completa.', area: 'barraca', estado: 'planned', eta: 'Julio 2026' },
  { titulo: 'Mejora-precio con IA Gemini', descripcion: 'Sube foto/PDF de cotización rival, IA extrae SKUs y matchea automáticamente.', area: 'barraca', estado: 'planned', eta: 'Julio 2026' },
  { titulo: 'Express checkout (Apple Pay / Google Pay)', descripcion: 'Pago 1-click sin escribir tarjeta.', area: 'barraca', estado: 'planned', eta: 'Agosto 2026' },
  { titulo: 'Garantía Klap activación', descripcion: 'Pre-autorización 24h sin cobro, libera al devolver máquina.', area: 'arriendo', estado: 'planned', eta: 'Agosto 2026' },
  { titulo: 'Customer 360 admin', descripcion: 'Vista cliente con historial completo cotizaciones + reviews + obras.', area: 'general', estado: 'planned', eta: 'Septiembre 2026' },
  { titulo: 'Cotizador admin con distancia automática', descripcion: 'Auto-calcula km de traslado según dirección.', area: 'arriendo', estado: 'planned', eta: 'Septiembre 2026' },
  { titulo: 'Reportes rentabilidad por máquina', descripcion: 'Ingresos vs costo + mantención por unidad.', area: 'arriendo', estado: 'planned', eta: 'Octubre 2026' },

  // ⚪ CONSIDERING (sin fecha)
  { titulo: 'App móvil iOS/Android', descripcion: 'Si demanda lo justifica, app nativa con notificaciones push.', area: 'general', estado: 'considering' },
  { titulo: 'SII DTE integration', descripcion: 'Facturas electrónicas directo a SII desde admin.', area: 'general', estado: 'considering' },
  { titulo: 'Asistente IA por voz', descripcion: 'Botón "Háblame" → audio query → respuesta hablada por Gemini.', area: 'general', estado: 'considering' },
  { titulo: 'Variantes de producto (talla/color)', descripcion: 'Útil si crece SKUs ferretería + pinturas. Decisión pendiente.', area: 'barraca', estado: 'considering' },
];

const ESTADO_META: Record<Estado, { label: string; bg: string; color: string; icon: string }> = {
  done: { label: 'Listo', bg: 'bg-green-100', color: 'text-green-700', icon: '✓' },
  shipping: { label: 'En desarrollo', bg: 'bg-orange-100', color: 'text-orange-700', icon: '🚧' },
  planned: { label: 'Planeado', bg: 'bg-blue-100', color: 'text-blue-700', icon: '📅' },
  considering: { label: 'Evaluando', bg: 'bg-gray-100', color: 'text-gray-700', icon: '💭' },
};

const AREA_META: Record<Item['area'], { label: string; color: string }> = {
  barraca: { label: 'Barraca', color: 'text-orange-600' },
  arriendo: { label: 'Arriendo', color: 'text-blue-600' },
  general: { label: 'General', color: 'text-purple-600' },
};

export default function RoadmapPage() {
  const grouped = {
    done: ITEMS.filter((i) => i.estado === 'done'),
    shipping: ITEMS.filter((i) => i.estado === 'shipping'),
    planned: ITEMS.filter((i) => i.estado === 'planned'),
    considering: ITEMS.filter((i) => i.estado === 'considering'),
  };

  return (
    <>
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link href="/" className="hover:text-orange-400 transition-colors">Inicio</Link>
            <span>›</span>
            <span className="text-gray-300">Roadmap</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold text-white mb-3">
            Roadmap <span className="text-orange-500">público</span> JURMAQ
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl">
            Qué estamos construyendo. Qué viene. Y por qué somos los únicos en Chile que comparten esto.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {(['done', 'shipping', 'planned', 'considering'] as Estado[]).map((s) => (
              <a
                key={s}
                href={`#${s}`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${ESTADO_META[s].bg} ${ESTADO_META[s].color}`}
              >
                <span>{ESTADO_META[s].icon}</span>
                <span>{ESTADO_META[s].label}</span>
                <span className="opacity-60">{grouped[s].length}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {(['shipping', 'planned', 'done', 'considering'] as Estado[]).map((estado) => (
            <div key={estado} id={estado}>
              <div className="flex items-baseline gap-3 mb-5">
                <h2 className={`text-2xl lg:text-3xl font-extrabold ${ESTADO_META[estado].color}`}>
                  {ESTADO_META[estado].icon} {ESTADO_META[estado].label}
                </h2>
                <span className="text-sm text-gray-500">{grouped[estado].length} items</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                {grouped[estado].map((item, i) => (
                  <div
                    key={`${estado}-${i}`}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:border-orange-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-navy-950 text-base lg:text-lg leading-snug">
                        {item.titulo}
                      </h3>
                      <span className={`shrink-0 text-xs font-bold uppercase tracking-wider ${AREA_META[item.area].color}`}>
                        {AREA_META[item.area].label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.descripcion}</p>
                    {item.eta && (
                      <p className="mt-3 text-xs font-semibold text-gray-500">
                        ETA: {item.eta}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 lg:py-16 bg-orange-500">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-navy-950 mb-3">
            ¿Te falta un feature importante?
          </h2>
          <p className="text-navy-900 mb-6">
            Escríbenos por WhatsApp con la idea. Las que más se piden las priorizamos.
          </p>
          <a
            href="https://wa.me/56976673577?text=Hola%2C%20tengo%20una%20idea%20para%20la%20web%20de%20JURMAQ"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-navy-950 hover:bg-navy-900 text-white font-bold rounded-xl transition-colors"
          >
            💬 Sugerir feature
          </a>
        </div>
      </section>
    </>
  );
}
