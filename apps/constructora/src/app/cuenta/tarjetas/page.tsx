import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

export const dynamic = 'force-dynamic';

const brandLabel: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'Amex',
};

export default async function TarjetasPage() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { data } = await supabaseAdmin
    .from('klap_cards')
    .select('id, card_brand, card_last4, card_exp_month, card_exp_year, is_default, activa, created_at')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false });

  const cards = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis tarjetas guardadas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tarjetas registradas para garantías de arriendo. No almacenamos el número completo ni el CVV,
          sólo un token seguro.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
          No tienes tarjetas guardadas todavía. Se agregan automáticamente cuando autorizas una garantía
          en un contrato de arriendo.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <div key={String(c.id)} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-navy-950 rounded text-white text-xs flex items-center justify-center font-bold">
                  {brandLabel[c.card_brand as string] || c.card_brand}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {brandLabel[c.card_brand as string] || c.card_brand} •••• {c.card_last4}
                  </div>
                  <div className="text-xs text-gray-500">
                    Vence {String(c.card_exp_month).padStart(2, '0')}/{c.card_exp_year}
                    {c.is_default ? ' · Tarjeta por defecto' : ''}
                  </div>
                </div>
              </div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  c.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">¿Cómo se eliminan?</h3>
        <p className="text-xs text-blue-800">
          Para proteger tus datos, eliminamos automáticamente tus tarjetas guardadas 90 días después de
          la última devolución de máquina (cuando ya no haya garantías activas). Si quieres eliminarlas
          antes,{' '}
          <Link href="/contacto" className="underline">
            escríbenos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
