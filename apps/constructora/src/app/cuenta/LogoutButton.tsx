'use client';

import { useState } from 'react';

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/cuenta/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } finally {
      window.location.href = '/cuenta/login';
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl"
    >
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
