import { exigirPermiso } from '@/lib/panel';
import FormMaquina from '@/components/admin/FormMaquina';

export default async function NuevaMaquina() {
  await exigirPermiso('maquinarias', 'create');
  return (
    <>
      <h1 className="text-3xl">Agregar máquina</h1>
      <FormMaquina />
    </>
  );
}
