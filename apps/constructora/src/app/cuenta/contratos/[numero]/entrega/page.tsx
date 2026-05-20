import { notFound } from 'next/navigation';
import Link from 'next/link';
import EntregaClient from './EntregaClient';

export const dynamic = 'force-dynamic';

interface EntregaInfo {
  contrato: { id: number; numero: string; monto: number; nombre: string | null };
  ya_autorizado: boolean;
  hold_id: string | null;
}

export default async function EntregaPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { numero } = await params;
  const sp = await searchParams;
  const token = sp.token;

  if (!token) notFound();

  // Server-side fetch to avoid token leak in client.
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://jurmaq.cl';
  let data: EntregaInfo | null = null;
  try {
    const res = await fetch(`${base}/api/public/contratos/entrega/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      data = (await res.json()) as EntregaInfo;
    }
  } catch {
    // silent
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto mt-8 bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido o vencido</h1>
        <p className="text-sm text-gray-500 mb-4">
          Este link de autorización de garantía no es válido o ya expiró. Contáctanos para regenerarlo.
        </p>
        <Link href="/" className="text-orange-600 hover:underline text-sm">
          Volver al sitio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-6">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Autoriza tu garantía</h1>
        <p className="text-sm text-gray-500 mt-1">
          Contrato {data.contrato.numero || `#${data.contrato.id}`}
          {data.contrato.nombre ? ` · ${data.contrato.nombre}` : ''}
        </p>
      </div>

      <EntregaClient
        token={token}
        ya_autorizado={data.ya_autorizado}
        monto={data.contrato.monto}
        contratoNumero={data.contrato.numero}
        contratoDecodedNumero={decodeURIComponent(numero)}
      />
    </div>
  );
}
