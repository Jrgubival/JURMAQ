import Link from 'next/link';

export default function NoEncontrada() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-4xl">No encontramos esa página</h1>
      <Link href="/maquinarias" prefetch={false} className="boton boton-principal mt-6">Ver máquinas</Link>
    </div>
  );
}
