import { redirect } from 'next/navigation';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import PerfilClient from './PerfilClient';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { data } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, rut, empresa, telefono, direccion')
    .eq('id', cliente.id)
    .single();

  return <PerfilClient perfil={data ?? { id: cliente.id, email: cliente.email, nombre: cliente.nombre, rut: null, empresa: null, telefono: null, direccion: null }} />;
}
