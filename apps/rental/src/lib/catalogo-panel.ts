import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { leerMaquina } from './maquinas';

export async function catalogoPanel() {
  const { data } = await supabaseAdmin.from('maquinarias').select('*').order('id');
  return (data ?? [])
    .map((f) => leerMaquina(f as Record<string, unknown>))
    .map(({ id, nombre, precios }) => ({ id, nombre, precios }));
}
