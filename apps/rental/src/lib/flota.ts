import 'server-only';
import { cache } from 'react';
import { supabasePublic } from '@jurmaq/shared/supabase';
import { leerMaquina, type Maquina } from './maquinas';

/** Lanza si falla: mejor servir la página anterior en caché que una flota vacía. */
export const obtenerFlota = cache(async (): Promise<Maquina[]> => {
  const { data, error } = await supabasePublic.from('maquinarias').select('*').order('id');
  if (error) throw new Error('No se pudo leer la flota');
  return (data ?? []).map((f) => leerMaquina(f as Record<string, unknown>)).filter((m) => m.publicada);
});

export async function obtenerMaquina(id: number): Promise<Maquina | null> {
  const flota = await obtenerFlota();
  return flota.find((m) => m.id === id) ?? null;
}
