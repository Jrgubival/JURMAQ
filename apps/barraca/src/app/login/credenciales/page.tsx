import { redirect } from 'next/navigation';

/** El login con contraseña se eliminó (nov-2026): ahora es con código por correo. */
export default function CredencialesPage() {
  redirect('/login');
}
