import GuardModulo from '@/components/admin/GuardModulo';

/** Sólo roles con permiso de barraca_productos (el vendedor no entra). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuardModulo module="barraca_productos" seccion="los productos">{children}</GuardModulo>;
}
