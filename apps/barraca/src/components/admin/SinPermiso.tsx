import Link from 'next/link';

/** Lo que ve alguien con sesión que entra a una sección que su rol no tiene. */
export default function SinPermiso({ seccion }: { seccion: string }) {
  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <p className="cifra text-[26px] font-semibold uppercase tracking-[0.04em] text-navy-950">Sin acceso</p>
      <p className="mt-2 text-[15px] text-[#4A4945]">
        Tu usuario no puede ver {seccion}. Si lo necesitas, pídeselo al administrador.
      </p>
      <Link href="/admin" className="mt-6 inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg bg-navy-950 text-white text-[15px] font-semibold">
        Ir a Ventas
      </Link>
    </div>
  );
}
