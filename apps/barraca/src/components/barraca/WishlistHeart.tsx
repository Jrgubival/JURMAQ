'use client';

import { useEffect, useState } from 'react';

/**
 * Botón ícono de corazón que toggle el producto en wishlist del cliente
 * logueado. Si no hay sesión, redirige a /cuenta/login.
 *
 * Usar dentro de cards de producto:
 *   <WishlistHeart productoId={123} />
 *
 * Si el cliente no está logueado: clic → /cuenta/login?next=/categorias/...
 * (sin tracking persistente; guest no acumula wishlist hasta registrarse).
 */
export default function WishlistHeart({
  productoId,
  size = 'md',
  className = '',
}: {
  productoId: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  // Check sesión al mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('barraca_token');
    setLoggedIn(!!token);
    if (!token) return;

    // Load wishlist completa y chequear si este productoId está. Cache simple
    // en sessionStorage para no llamar el endpoint en cada card.
    let cached: number[] | null = null;
    try {
      const raw = sessionStorage.getItem('barraca_wishlist_ids');
      if (raw) cached = JSON.parse(raw);
    } catch {}

    if (cached && Array.isArray(cached)) {
      setInWishlist(cached.includes(productoId));
      return;
    }

    void fetch('/api/cuenta/wishlist', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const ids = (data.items || []).map((i: { producto_id: number }) => i.producto_id);
        sessionStorage.setItem('barraca_wishlist_ids', JSON.stringify(ids));
        setInWishlist(ids.includes(productoId));
      })
      .catch(() => undefined);
  }, [productoId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('barraca_token');
    if (!token) {
      window.location.href = '/cuenta/login?next=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoading(true);
    try {
      if (inWishlist) {
        await fetch(`/api/cuenta/wishlist?producto_id=${productoId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setInWishlist(false);
      } else {
        await fetch('/api/cuenta/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ producto_id: productoId }),
        });
        setInWishlist(true);
      }
      // Invalidar cache.
      sessionStorage.removeItem('barraca_wishlist_ids');
    } finally {
      setLoading(false);
    }
  }

  const sizeCls = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const iconCls = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={inWishlist ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos'}
      title={inWishlist ? 'Quitar de mi lista' : 'Guardar en mi lista'}
      className={`${sizeCls} flex items-center justify-center rounded-full transition-all ${
        inWishlist
          ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
          : 'bg-white/90 hover:bg-white text-gray-500 hover:text-red-500 border border-gray-200 shadow-sm'
      } ${className} ${loading ? 'opacity-70' : ''}`}
    >
      <svg className={iconCls} fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
      </svg>
    </button>
  );
}
