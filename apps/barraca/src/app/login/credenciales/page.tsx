import type { Metadata } from "next";
import LoginCredenciales from "./LoginCredenciales";

export const metadata: Metadata = {
  title: "Acceso administración · JURMAQ Barraca",
  robots: { index: false, follow: false },
};

/** Solo paths relativos del mismo sitio — nunca URLs absolutas (open redirect). */
function safeCallback(url: string | undefined): string {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/admin";
  return url;
}

/**
 * Respaldo del login de administración con email y contraseña (tabla
 * public.users, filtrada por AUTH_SCOPE en el provider Credentials de
 * NextAuth). Reemplaza a /cuenta/login, que se eliminó junto con las cuentas
 * de cliente (oct-2026). La vía normal es /login (Google).
 */
export default async function CredencialesPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <LoginCredenciales callbackUrl={safeCallback(callbackUrl)} />;
}
