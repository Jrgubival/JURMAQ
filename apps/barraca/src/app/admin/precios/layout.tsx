import GuardModulo from '@/components/admin/GuardModulo';

/** Sólo roles con permiso de barraca_precios (el vendedor no entra). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuardModulo module="barraca_precios" seccion="los precios">{children}</GuardModulo>;
}
