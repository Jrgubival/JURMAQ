'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchImageCandidates, type ImageCandidate } from '@/lib/imagenes-search';

/* ───────────────────── Types ───────────────────── */

interface Producto {
  id: number;
  codigo: string | null;
  nombre: string;
  imagen: string | null;
  categoria_nombre?: string;
  categoria_slug?: string;
}

interface SimilarProduct {
  id: number;
  nombre: string;
  codigo: string | null;
  imagen: string | null;
  needsImage: boolean;
}

/* ────────────────── Component ──────────────────── */

export default function ImagenesBarracaPage() {
  // Product queue state
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalSinImagen, setTotalSinImagen] = useState(0);
  const [totalAsignados, setTotalAsignados] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Image search state
  const [images, setImages] = useState<ImageCandidate[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState('');

  // Similar products state
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<Set<number>>(new Set());
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Feedback state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentProduct = productos[currentIndex] || null;

  /* ──────────── Fetch products without images ──────────── */

  const fetchProducts = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      // Fetch all active products, we'll filter client-side for those needing images
      const res = await fetch(
        `/api/productos?page=${pageNum}&limit=50`
      );
      const data = await res.json();

      if (data.productos) {
        const needImage = data.productos.filter(
          (p: Producto) =>
            !p.imagen || p.imagen === '' || p.imagen.startsWith('/images/barraca/')
        );
        setProductos((prev) => (pageNum === 1 ? needImage : [...prev, ...needImage]));
        setTotalSinImagen(data.total);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  /* ──────────── Fetch candidate images (client-side DuckDuckGo + fallback) ──────────── */
  // Implementación movida a src/lib/imagenes-search.ts. La función abstrae
  // el flujo de 2 capas (DuckDuckGo → server API curado) detrás de
  // `searchImageCandidates(productName)`.

  const searchImages = useCallback(async (query: string) => {
    setLoadingImages(true);
    setSelectedImage(null);
    try {
      const candidates = await searchImageCandidates(query);
      setImages(candidates);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    if (currentProduct) {
      searchImages(currentProduct.nombre);
      setShowSimilar(false);
      setSimilarProducts([]);
      setSelectedSimilarIds(new Set());
      setManualSearch('');
    }
  }, [currentProduct, searchImages]);

  /* ──────────── Fetch similar products ──────────── */

  const fetchSimilar = useCallback(async (productoId: number) => {
    setLoadingSimilar(true);
    try {
      const res = await fetch(
        `/api/imagenes/similar?productoId=${productoId}`
      );
      const data = await res.json();
      const sims: SimilarProduct[] = data.similar || [];
      setSimilarProducts(sims);
      // Pre-select products that need images
      setSelectedSimilarIds(
        new Set(sims.filter((s) => s.needsImage).map((s) => s.id))
      );
    } catch (err) {
      console.error('Error fetching similar:', err);
      setSimilarProducts([]);
    } finally {
      setLoadingSimilar(false);
    }
  }, []);

  /* ──────────── Assign image ──────────── */

  const assignImage = async () => {
    if (selectedImage === null || !currentProduct) return;
    const imageUrl = images[selectedImage]?.url;
    if (!imageUrl) return;

    // Show similar products step
    if (!showSimilar) {
      setShowSimilar(true);
      fetchSimilar(currentProduct.id);
      return;
    }

    // Actually save
    setSaving(true);
    try {
      const res = await fetch('/api/imagenes/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: currentProduct.id,
          imagen: imageUrl,
          similarIds: Array.from(selectedSimilarIds),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        const count = data.updated || 1;
        setTotalAsignados((prev) => prev + count);
        showToast(
          `Imagen asignada a ${count} producto${count > 1 ? 's' : ''}`
        );
        moveToNext();
      } else {
        showToast('Error al asignar imagen');
      }
    } catch (err) {
      console.error('Error assigning image:', err);
      showToast('Error al asignar imagen');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────── Navigation ──────────── */

  const moveToNext = () => {
    setShowSimilar(false);
    setSelectedImage(null);
    setSimilarProducts([]);
    setSelectedSimilarIds(new Set());

    if (currentIndex < productos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Load more products
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const skip = () => {
    showToast('Producto saltado');
    moveToNext();
  };

  /* ──────────── Toast ──────────── */

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  /* ──────────── Keyboard shortcuts ──────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (selectedImage !== null) assignImage();
      }
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault();
        if (showSimilar) {
          setShowSimilar(false);
        } else {
          skip();
        }
      }
      // Number keys 1-6 to select image
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 6 && num <= images.length) {
        e.preventDefault();
        setSelectedImage(num - 1);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage, showSimilar, images.length, currentProduct]);

  /* ──────────── Render helpers ──────────── */

  const progressPercent =
    totalSinImagen > 0
      ? Math.round((totalAsignados / totalSinImagen) * 100)
      : 0;

  const toggleSimilarId = (id: number) => {
    setSelectedSimilarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ──────────── Loading state ──────────── */

  if (loading && productos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white rounded-2xl shadow-xl p-12 max-w-md">
          <div className="text-6xl mb-4">&#127881;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            &#161;Todo listo!
          </h2>
          <p className="text-gray-500">
            No hay mas productos sin imagen por asignar en este lote.
          </p>
          <button
            onClick={() => {
              setPage(1);
              setCurrentIndex(0);
              setProductos([]);
              fetchProducts(1);
            }}
            className="mt-6 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
          >
            Recargar productos
          </button>
        </div>
      </div>
    );
  }

  /* ──────────── Main render ──────────── */

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl animate-fade-in text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header + Progress */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Asignar Imagenes a Productos
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Productos sin imagen:{' '}
              <span className="font-semibold text-gray-700">
                {totalSinImagen - totalAsignados}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Producto{' '}
              <span className="font-bold text-gray-800">
                {currentIndex + 1}
              </span>{' '}
              de{' '}
              <span className="font-bold text-gray-800">
                {productos.length}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalAsignados} asignados en esta sesion
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(progressPercent, 100)}%`,
              background: 'linear-gradient(90deg, #f97316, #fb923c)',
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">
          {progressPercent}% completado
        </p>
      </div>

      {/* Product card */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        {/* Product info */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">
                Producto actual
              </p>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">
                {currentProduct.nombre}
              </h2>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                {currentProduct.categoria_nombre && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {currentProduct.categoria_nombre}
                  </span>
                )}
                {currentProduct.codigo && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    {currentProduct.codigo}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={skip}
              className="ml-4 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              title="Saltar producto (flecha izquierda)"
            >
              Saltar
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Manual search */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualSearch.trim()) {
                  searchImages(manualSearch.trim());
                }
              }}
              placeholder="Buscar manualmente..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            <button
              onClick={() => {
                if (manualSearch.trim()) searchImages(manualSearch.trim());
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Image candidates grid */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Imagenes sugeridas{' '}
            <span className="text-gray-300 font-normal">
              (presiona 1-6 para seleccionar)
            </span>
          </p>

          {loadingImages ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No se encontraron imagenes.</p>
              <p className="text-sm mt-1">
                Intenta buscar con otros terminos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all duration-200 group focus:outline-none ${
                    selectedImage === i
                      ? 'border-green-500 ring-4 ring-green-500/30 scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Number badge */}
                  <span
                    className={`absolute top-2 left-2 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shadow-lg ${
                      selectedImage === i
                        ? 'bg-green-500 text-white'
                        : 'bg-white/90 text-gray-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {/* Check mark for selected */}
                  {selectedImage === i && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-green-500 rounded-full p-2">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                  {/* Source label */}
                  <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {img.source}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!showSimilar && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={assignImage}
              disabled={selectedImage === null || saving}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                selectedImage !== null
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Usar esta imagen (flecha derecha)"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Usar esta imagen
              <kbd className="ml-2 text-xs opacity-60 bg-white/20 px-1.5 py-0.5 rounded">
                &#8594;
              </kbd>
            </button>
            <button
              onClick={skip}
              className="px-6 py-4 rounded-xl text-lg font-bold bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              title="Saltar (flecha izquierda)"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Similar products section */}
      {showSimilar && (
        <div className="bg-white rounded-2xl shadow-xl p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            &#191;Aplicar a productos similares?
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona los productos que deben usar la misma imagen.
          </p>

          {loadingSimilar ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : similarProducts.length === 0 ? (
            <p className="text-gray-400 text-sm py-4">
              No se encontraron productos similares.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {similarProducts.map((sp) => (
                <label
                  key={sp.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    selectedSimilarIds.has(sp.id)
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSimilarIds.has(sp.id)}
                    onChange={() => toggleSimilarId(sp.id)}
                    className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-400"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {sp.nombre}
                    </p>
                    <p className="text-xs text-gray-400">
                      {sp.codigo || 'Sin codigo'}
                      {sp.needsImage && (
                        <span className="ml-2 text-orange-500">
                          Sin imagen
                        </span>
                      )}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={assignImage}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 transition-all duration-200 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Aplicar a{' '}
                  {selectedSimilarIds.size > 0
                    ? `${selectedSimilarIds.size + 1} productos`
                    : '1 producto'}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedSimilarIds(new Set());
                assignImage();
              }}
              disabled={saving}
              className="px-6 py-4 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors disabled:opacity-50"
            >
              Solo este producto
            </button>
            <button
              onClick={() => setShowSimilar(false)}
              className="px-4 py-4 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-400 pb-8">
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            1-6
          </kbd>{' '}
          Seleccionar imagen
        </span>
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            &#8594;
          </kbd>{' '}
          Usar imagen
        </span>
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            &#8592;
          </kbd>{' '}
          Saltar
        </span>
        <span>
          <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            Esc
          </kbd>{' '}
          Volver / Saltar
        </span>
      </div>
    </div>
  );
}
