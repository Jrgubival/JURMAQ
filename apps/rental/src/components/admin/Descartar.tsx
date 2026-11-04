'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Descartar({ id }: { id: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);

  async function descartar() {
    if (!window.confirm('¿Descartar esta solicitud?')) return;
    setError(false);
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/solicitudes/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('descartar');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button type="button" className="min-h-12 px-2 underline underline-offset-4" disabled={ocupado} onClick={descartar}>Descartar</button>
      {error ? <span role="alert" className="text-peligro">No se pudo descartar.</span> : null}
    </>
  );
}
