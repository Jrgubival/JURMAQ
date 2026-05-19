import type { Metadata } from 'next';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Iniciar sesión — Mi cuenta JURMAQ',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const cliente = await getClienteFromRequest();
  if (cliente) {
    redirect('/cuenta');
  }
  return <LoginClient />;
}
