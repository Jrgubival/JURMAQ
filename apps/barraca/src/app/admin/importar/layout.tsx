import GuardModulo from '@/components/admin/GuardModulo';

/** Sólo roles con permiso de barraca_importar (el vendedor no entra). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuardModulo module="barraca_importar" seccion="la carga de precios">{children}</GuardModulo>;
}
