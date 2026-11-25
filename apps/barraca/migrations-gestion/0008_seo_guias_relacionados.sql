-- SEO editable (título y descripción para Google por producto, categoría y página),
-- guías editables y productos relacionados fijados a mano. Etapa 2 del MCP.
-- Detalle y reglas: docs/MCP-NOTAS.md ("SEO editable, guías y relacionados").
-- Tiempos en milisegundos desde epoch (INTEGER). JSON como TEXT.
--
-- Sin fila = la tienda usa lo que genera el código (la regla de oro: con esta base vacía o
-- caída, las metas son idénticas a las de siempre).

-- Texto propio vigente. Una fila por entrada; `clave` = código de producto (todas sus fichas),
-- slug de categoría o id de página (portada, nosotros, terminos...).
CREATE TABLE seo_meta (
  tipo            TEXT NOT NULL CHECK (tipo IN ('producto', 'categoria', 'pagina')),
  clave           TEXT NOT NULL,
  titulo          TEXT,
  descripcion     TEXT,
  og_titulo       TEXT,
  og_descripcion  TEXT,
  -- Clave de comparación del título (sin tildes ni mayúsculas) para avisar de repetidos.
  titulo_clave    TEXT,
  version         INTEGER NOT NULL,
  actualizado_por TEXT NOT NULL,
  actualizado_en  INTEGER NOT NULL,
  PRIMARY KEY (tipo, clave)
);
CREATE INDEX seo_meta_titulo_idx ON seo_meta (titulo_clave);

-- Historial: una fila por cada cambio (incluye «volver al texto automático», con todos los textos NULL).
CREATE TABLE seo_versiones (
  tipo            TEXT NOT NULL,
  clave           TEXT NOT NULL,
  version         INTEGER NOT NULL,
  titulo          TEXT,
  descripcion     TEXT,
  og_titulo       TEXT,
  og_descripcion  TEXT,
  creado_por      TEXT NOT NULL,
  creado_email    TEXT,
  creado_en       INTEGER NOT NULL,
  lote_id         TEXT,
  PRIMARY KEY (tipo, clave, version)
);

-- Relacionados fijados a mano por código de producto: lista ordenada (JSON de códigos).
-- Sin fila = el criterio automático de la ficha (misma categoría, con más stock).
CREATE TABLE productos_relacionados (
  codigo          TEXT PRIMARY KEY,
  lista           TEXT NOT NULL,
  actualizado_por TEXT NOT NULL,
  actualizado_en  INTEGER NOT NULL
);

-- Guías editables: borrador y publicado por slug; cada publicación es una versión.
CREATE TABLE guias (
  slug               TEXT PRIMARY KEY,
  borrador           TEXT,
  borrador_por       TEXT,
  borrador_en        INTEGER,
  publicado          TEXT,
  version_publicada  INTEGER,
  publicado_por      TEXT,
  publicado_en       INTEGER
);

CREATE TABLE guias_versiones (
  slug           TEXT NOT NULL,
  version        INTEGER NOT NULL,
  valor          TEXT NOT NULL,
  estado         TEXT NOT NULL CHECK (estado IN ('publicada', 'reemplazada')),
  nota           TEXT,
  creado_por     TEXT NOT NULL,
  creado_en      INTEGER NOT NULL,
  restaurada_de  INTEGER,
  PRIMARY KEY (slug, version)
);
