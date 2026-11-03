'use client';

import { useState, type FormEvent } from 'react';
import { Boton, Campo } from '@jurmaq/shared/ui/grupo';

const NEGOCIOS = [
  { value: 'arriendo', label: 'Arriendo de maquinaria' },
  { value: 'barraca', label: 'Barraca de fierros' },
  { value: 'constructora', label: 'Constructora' },
  { value: 'otro', label: 'Otro' },
];

export default function FormularioContacto() {
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'ok' | 'error'>('libre');
  const [error, setError] = useState('');

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    setEstado('enviando');
    setError('');
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNombre: datos.get('nombre'),
          clienteEmail: datos.get('email'),
          clienteTelefono: datos.get('telefono'),
          servicio: datos.get('negocio'),
          mensaje: datos.get('mensaje'),
        }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new Error(cuerpo.error || 'No se pudo enviar. Intenta de nuevo.');
      }
      form.reset();
      setEstado('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Intenta de nuevo.');
      setEstado('error');
    }
  }

  return (
    <form className="h-form" onSubmit={enviar}>
      <div className="h-form__dos">
        <Campo id="nombre" etiqueta="Nombre">
          <input id="nombre" name="nombre" autoComplete="name" required />
        </Campo>
        <Campo id="telefono" etiqueta="Teléfono">
          <input id="telefono" name="telefono" type="tel" autoComplete="tel" required />
        </Campo>
      </div>
      <div className="h-form__dos">
        <Campo id="email" etiqueta="Correo">
          <input id="email" name="email" type="email" autoComplete="email" />
        </Campo>
        <Campo id="negocio" etiqueta="¿Con qué negocio?">
          <select id="negocio" name="negocio" defaultValue="">
            <option value="" disabled>Elige una opción</option>
            {NEGOCIOS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo id="mensaje" etiqueta="Mensaje">
        <textarea id="mensaje" name="mensaje" rows={5} required />
      </Campo>
      <label className="h-check">
        <input type="checkbox" required />
        <span>
          Acepto la <a className="g-enlace" href="/privacidad">política de privacidad</a>.
        </span>
      </label>
      <div>
        <Boton type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Enviando…' : 'Enviar mensaje'}
        </Boton>
      </div>
      <div aria-live="polite">
        {estado === 'ok' && <p className="h-estado h-estado--ok">Recibimos tu mensaje. Te contactaremos pronto.</p>}
        {estado === 'error' && <p className="h-estado h-estado--error">{error}</p>}
      </div>
    </form>
  );
}
