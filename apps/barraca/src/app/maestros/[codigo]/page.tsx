import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import MaestroLandingClient from './MaestroLandingClient';

/**
 * /maestros/[codigo] — Página pública del programa de referidos.
 *
 * El maestro comparte este link con sus clientes:
 *   "Comprá acá: https://barraca.jurmaq.cl/maestros/MAE-2026-001"
 *
 * Al entrar, el código se persiste en localStorage (`barraca_maestro_codigo`)
 * y se autoaplica en /carrito y /cotizar.
 *
 * SEO: dofollow normal, OK indexar — son links de afiliados con valor SEO
 * para que el maestro pueda compartir sin nofollow.
 */

interface MaestroPublic {
  codigo: string;
  nombre: string;
  porcentaje_comision: number;
  miembro_desde: string;
  total_referidos: number;
}

async function getMaestro(codigo: string): Promise<MaestroPublic | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');

  try {
    const res = await fetch(`${baseUrl}/api/public/maestros/${codigo}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const maestro = await getMaestro(codigo);
  if (!maestro) {
    return { title: 'Maestro no encontrado · JURMAQ Barraca' };
  }
  return {
    title: `${maestro.nombre} · Maestro recomendado · JURMAQ Barraca`,
    description: `Compra en JURMAQ Barraca con el código de ${maestro.nombre}. Al usar el código ${maestro.codigo} en checkout, apoyás a tu maestro de confianza.`,
  };
}

export default async function MaestroLandingPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const maestro = await getMaestro(codigo);
  if (!maestro) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-navy-950 to-navy-800 px-6 py-8 text-white">
            <div className="text-center">
              <p className="text-orange-300 text-sm font-medium uppercase tracking-wide">
                Maestro Recomendado JURMAQ
              </p>
              <h1 className="text-3xl md:text-4xl font-bold mt-2">{maestro.nombre}</h1>
              <p className="font-mono text-orange-200 text-sm mt-2">{maestro.codigo}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="px-6 py-6 grid grid-cols-2 gap-4 border-b border-gray-100">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{maestro.total_referidos}</p>
              <p className="text-xs text-gray-500 mt-1">Clientes recomendados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {Number(maestro.porcentaje_comision).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Comisión por venta referida</p>
            </div>
          </div>

          {/* Llamado a acción */}
          <div className="px-6 py-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Comprá apoyando a tu maestro
            </h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Cuando vas al checkout en barraca.jurmaq.cl, ingresá el código <strong>{maestro.codigo}</strong> en
              el campo &ldquo;Código de Maestro Recomendado&rdquo;. Mismo precio para vos, pero apoyás
              directamente a {maestro.nombre.split(' ')[0]}.
            </p>

            <MaestroLandingClient codigo={maestro.codigo} nombre={maestro.nombre} />

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <Link
                href="/categorias"
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl"
              >
                Ver catálogo →
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-xl"
              >
                Ir al inicio
              </Link>
            </div>
          </div>

          {/* ¿Cómo funciona? */}
          <div className="bg-gray-50 px-6 py-6 border-t border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">¿Cómo funciona el programa?</h3>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Elegís los materiales que necesitás en barraca.jurmaq.cl.</li>
              <li>
                En el checkout/cotización, ingresá el código del maestro:{' '}
                <span className="font-mono font-semibold">{maestro.codigo}</span>.
              </li>
              <li>El precio para vos es exactamente el mismo (no es un descuento).</li>
              <li>
                JURMAQ paga {Number(maestro.porcentaje_comision).toFixed(1)}% del neto al maestro como reconocimiento
                por haberte derivado.
              </li>
            </ol>
          </div>

          {/* ¿Sos maestro? */}
          <div className="px-6 py-5 text-center text-xs text-gray-500">
            ¿Sos maestro de construcción y querés registrarte?{' '}
            <a href="https://wa.me/56983221440?text=Hola%2C+quiero+registrarme+como+maestro" className="text-orange-600 hover:underline">
              Escribinos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
