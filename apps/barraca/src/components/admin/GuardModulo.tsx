import { requirePermission } from '@jurmaq/shared/auth/guard';
import type { Module } from '@jurmaq/shared/roles';
import SinPermiso from './SinPermiso';

/**
 * Corta en el servidor una sección del panel que el rol no puede ver (por
 * ejemplo, el vendedor en Productos o Despacho). Las APIs igual responden 403:
 * esto evita que vea la pantalla vacía o a medio cargar.
 */
export default async function GuardModulo({ module, seccion, children }: { module: Module; seccion: string; children: React.ReactNode }) {
  const session = await requirePermission(module, 'read');
  if (!session) return <SinPermiso seccion={seccion} />;
  return <>{children}</>;
}
