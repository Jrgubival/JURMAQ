import GuardModulo from '@/components/admin/GuardModulo';

/** Sólo roles con permiso de barraca_promociones (el vendedor no entra). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuardModulo module="barraca_promociones" seccion="los cupones">{children}</GuardModulo>;
}
