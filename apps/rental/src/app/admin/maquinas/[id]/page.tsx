import { exigirPermiso } from '@/lib/panel';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import FormMaquina from '@/components/admin/FormMaquina';
import { leerMaquina } from '@/lib/maquinas';

export default async function EditarMaquina({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso('maquinarias', 'update');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { data } = await supabaseAdmin.from('maquinarias').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const m = leerMaquina(data as Record<string, unknown>);
  return (
    <>
      <h1 className="text-3xl">{m.nombre}</h1>
      <FormMaquina maquina={m} />
    </>
  );
}
