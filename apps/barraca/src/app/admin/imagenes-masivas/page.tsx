'use client';

import { useState, useEffect } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  imagen: string | null;
  producto_count: number;
  subcategorias?: Categoria[];
}

interface Producto {
  id: number;
  nombre: string;
  imagen: string | null;
  categoria_id: number;
}

export default function ImagenesMasivasPage() {
  // Step 1 state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [applyingCat, setApplyingCat] = useState<number | null>(null);
  const [catResults, setCatResults] = useState<Record<number, string>>({});

  // Step 2 state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [newImageUrl, setNewImageUrl] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  // Load categories
  useEffect(() => {
    fetchCategorias();
  }, []);

  async function fetchCategorias() {
    try {
      const res = await fetch('/api/categorias');
      const data = await res.json();
      // Flatten: include parent categories and subcategories
      const flat: Categoria[] = [];
      for (const cat of data) {
        flat.push(cat);
        if (cat.subcategorias) {
          for (const sub of cat.subcategorias) {
            flat.push(sub);
          }
        }
      }
      setCategorias(flat);
    } catch (err) {
      console.error('Error cargando categorias:', err);
    } finally {
      setLoadingCats(false);
    }
  }

  async function applyCategoryImage(cat: Categoria) {
    if (!cat.imagen) return;
    setApplyingCat(cat.id);
    setCatResults((prev) => ({ ...prev, [cat.id]: '' }));
    try {
      const res = await fetch('/api/productos/bulk-image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'by_category',
          categoriaId: cat.id,
          imagen: cat.imagen,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatResults((prev) => ({
          ...prev,
          [cat.id]: `${data.updated} productos actualizados`,
        }));
      } else {
        setCatResults((prev) => ({
          ...prev,
          [cat.id]: `Error: ${data.error}`,
        }));
      }
    } catch {
      setCatResults((prev) => ({
        ...prev,
        [cat.id]: 'Error de conexion',
      }));
    } finally {
      setApplyingCat(null);
    }
  }

  async function searchProducts() {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedIds(new Set());
    setBulkResult('');
    try {
      const res = await fetch(
        `/api/productos?buscar=${encodeURIComponent(searchTerm)}&limit=200&all=true`
      );
      const data = await res.json();
      setSearchResults(data.productos || []);
      // Select all by default
      const allIds = new Set<number>((data.productos || []).map((p: Producto) => p.id));
      setSelectedIds(allIds);
    } catch (err) {
      console.error('Error buscando productos:', err);
    } finally {
      setSearching(false);
    }
  }

  function toggleProduct(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === searchResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(searchResults.map((p) => p.id)));
    }
  }

  async function applyBulkImage() {
    if (selectedIds.size === 0 || !newImageUrl.trim()) return;
    setApplyingBulk(true);
    setBulkResult('');
    try {
      const res = await fetch('/api/productos/bulk-image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'by_ids',
          ids: Array.from(selectedIds),
          imagen: newImageUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(`${data.updated} productos actualizados exitosamente`);
        // Refresh search to show updated images
        searchProducts();
      } else {
        setBulkResult(`Error: ${data.error}`);
      }
    } catch {
      setBulkResult('Error de conexion');
    } finally {
      setApplyingBulk(false);
    }
  }

  async function applyByPrefix() {
    if (!searchTerm.trim() || !newImageUrl.trim()) return;
    setApplyingBulk(true);
    setBulkResult('');
    try {
      const res = await fetch('/api/productos/bulk-image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'by_name_prefix',
          namePrefix: searchTerm.trim(),
          imagen: newImageUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(`${data.updated} productos actualizados por prefijo "${searchTerm}"`);
        searchProducts();
      } else {
        setBulkResult(`Error: ${data.error}`);
      }
    } catch {
      setBulkResult('Error de conexion');
    } finally {
      setApplyingBulk(false);
    }
  }

  // Group similar products by base name (first 2 words)
  function getBaseName(nombre: string): string {
    const words = nombre.trim().split(/\s+/);
    return words.slice(0, 2).join(' ');
  }

  const groupedResults: Record<string, Producto[]> = {};
  for (const p of searchResults) {
    const base = getBaseName(p.nombre);
    if (!groupedResults[base]) groupedResults[base] = [];
    groupedResults[base].push(p);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Asignacion Masiva de Imagenes
        </h1>
        <p className="text-gray-500 mt-1">
          Asigna imagenes por categoria o por nombre de producto similar
        </p>
      </div>

      {/* STEP 1: Category images */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Paso 1: Asignar imagen base por categoria
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Aplica la imagen de la categoria a todos los productos que no tengan imagen o tengan imagen local
        </p>

        {loadingCats ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categorias.map((cat) => (
              <div
                key={cat.id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col"
              >
                <h3 className="font-medium text-gray-800 text-sm truncate mb-2">
                  {cat.nombre}
                </h3>

                {/* Image preview */}
                <div className="w-full h-32 bg-gray-100 rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                  {cat.imagen ? (
                    <img
                      src={cat.imagen}
                      alt={cat.nombre}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12">Sin imagen</text></svg>';
                      }}
                    />
                  ) : (
                    <span className="text-gray-500 text-xs">Sin imagen</span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  {cat.producto_count} productos en esta categoria
                </p>

                {catResults[cat.id] && (
                  <p
                    className={`text-xs mb-2 ${
                      catResults[cat.id].startsWith('Error')
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {catResults[cat.id]}
                  </p>
                )}

                <button
                  onClick={() => applyCategoryImage(cat)}
                  disabled={!cat.imagen || applyingCat === cat.id}
                  className={`mt-auto w-full py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                    cat.imagen
                      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                      : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {applyingCat === cat.id
                    ? 'Aplicando...'
                    : cat.imagen
                    ? `Aplicar a ${cat.producto_count} productos`
                    : 'Sin imagen de categoria'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STEP 2: Search by name */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Paso 2: Modificar por nombre similar
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Busca productos por nombre y asigna una imagen a todos los seleccionados
        </p>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
            placeholder="Ej: FIERRO ESTRIADO, CLAVO, TORNILLO..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={searchProducts}
            disabled={searching || !searchTerm.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {searchResults.length} resultados para &quot;{searchTerm}&quot;
              </p>
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedIds.size === searchResults.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            </div>

            {/* Grouped results */}
            <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-xl p-3">
              {Object.entries(groupedResults).map(([baseName, products]) => (
                <div key={baseName}>
                  {Object.keys(groupedResults).length > 1 && (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {baseName} ({products.length})
                    </p>
                  )}
                  {products.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 py-2 px-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                        {p.imagen && !p.imagen.startsWith('/images/barraca/') ? (
                          <img
                            src={p.imagen}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {p.imagen
                            ? p.imagen.startsWith('/images/barraca/')
                              ? 'imagen local'
                              : 'imagen externa'
                            : 'sin imagen'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            {/* New image URL + apply */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Nueva imagen URL
              </label>
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Preview */}
              {newImageUrl && (
                <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden">
                  <img
                    src={newImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23fef2f2" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23ef4444" font-size="10">URL invalida</text></svg>';
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={applyBulkImage}
                  disabled={
                    applyingBulk || selectedIds.size === 0 || !newImageUrl.trim()
                  }
                  className="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {applyingBulk
                    ? 'Aplicando...'
                    : `Aplicar a ${selectedIds.size} seleccionados`}
                </button>

                <button
                  onClick={applyByPrefix}
                  disabled={
                    applyingBulk || !searchTerm.trim() || !newImageUrl.trim()
                  }
                  className="bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {applyingBulk
                    ? 'Aplicando...'
                    : `Aplicar a TODOS con prefijo "${searchTerm}"`}
                </button>
              </div>

              {bulkResult && (
                <p
                  className={`text-sm font-medium ${
                    bulkResult.startsWith('Error')
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {bulkResult}
                </p>
              )}
            </div>
          </div>
        )}

        {searchResults.length === 0 && !searching && searchTerm && (
          <p className="text-sm text-gray-500 py-4 text-center">
            No se encontraron productos. Intenta con otro termino.
          </p>
        )}
      </div>
    </div>
  );
}
