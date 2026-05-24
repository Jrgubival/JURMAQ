'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCLP } from '@jurmaq/shared/format';

interface WishlistItem {
  id: string;
  producto_id: number;
  created_at: string;
  barraca_productos: {
    id: number;
    nombre: string;
    slug: string | null;
    precio: number;
    imagen: string | null;
    stock: number;
  };
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = localStorage.getItem('barraca_token');
        if (!token) {
          setError('Debes iniciar sesión para ver tu lista de deseos.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/cuenta/wishlist', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError(res.status === 401 ? 'Sesión expirada' : `Error ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setItems(data.items || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function quitar(producto_id: number) {
    const token = localStorage.getItem('barraca_token');
    if (!token) return;
    await fetch(`/api/cuenta/wishlist?producto_id=${producto_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems((prev) => prev.filter((i) => i.producto_id !== producto_id));
  }

  async function agregarAlCarrito(producto_id: number) {
    await fetch('/api/carrito', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto_id, cantidad: 1 }),
    });
    window.dispatchEvent(new Event('cart-updated'));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">❤ Mi lista de deseos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} producto{items.length !== 1 ? 's' : ''} guardado{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/cuenta" className="text-sm text-orange-600 hover:underline">
          ← Volver a mi cuenta
        </Link>
      </div>

      {loading && <div className="text-sm text-gray-500">Cargando lista de deseos…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error} ·{' '}
          <Link href="/cuenta/login" className="underline font-semibold">
            Iniciar sesión
          </Link>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🤍</p>
          <p className="text-base font-semibold text-gray-900 mb-2">Tu lista está vacía</p>
          <p className="text-sm text-gray-500 mb-4">
            Mientras navegues por nuestro catálogo, presiona el corazón para guardar productos aquí.
          </p>
          <Link
            href="/categorias"
            className="inline-block px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl"
          >
            Explorar productos
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div
              key={it.id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link href={`/productos/${it.barraca_productos.slug || it.barraca_productos.id}`}>
                <div className="aspect-square bg-gray-100 relative">
                  {it.barraca_productos.imagen ? (
                    <Image
                      src={it.barraca_productos.imagen}
                      alt={it.barraca_productos.nombre}
                      fill
                      sizes="(max-width:768px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
                      📦
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-700 line-clamp-2 mb-1">
                    {it.barraca_productos.nombre}
                  </p>
                  <p className="font-bold text-navy-950 tabular-nums">
                    {formatCLP(it.barraca_productos.precio)}
                  </p>
                  {it.barraca_productos.stock === 0 && (
                    <p className="text-xs text-red-600 mt-1">Sin stock</p>
                  )}
                </div>
              </Link>
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => agregarAlCarrito(it.producto_id)}
                  disabled={it.barraca_productos.stock === 0}
                  className="flex-1 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-lg"
                >
                  + Carrito
                </button>
                <button
                  onClick={() => quitar(it.producto_id)}
                  className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                  title="Quitar de wishlist"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
