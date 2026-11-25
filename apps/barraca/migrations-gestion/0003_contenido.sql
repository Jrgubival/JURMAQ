-- Contenido editable de la tienda (términos, popup, slides, datos del local...).
-- Pieza B del MCP. Detalle y reglas: docs/MCP-NOTAS.md ("Contenido editable").
-- Tiempos en milisegundos desde epoch (INTEGER). JSON como TEXT.
--
-- Una fila por clave en `contenido` con el borrador y la copia publicada (la
-- tienda lee solo esta tabla, una consulta para todo). Cada publicación (o
-- publicación pendiente de aprobación) queda como una fila en
-- `contenido_versiones`: ese es el historial y de ahí se restaura.

CREATE TABLE contenido (
  clave              TEXT PRIMARY KEY,
  -- Borrador en edición (JSON). NULL = no hay borrador.
  borrador           TEXT,
  borrador_por       TEXT,
  borrador_email     TEXT,
  borrador_en        INTEGER,
  -- Lo publicado hoy (JSON). NULL = la tienda usa el respaldo en código.
  publicado          TEXT,
  version_publicada  INTEGER,
  publicado_por      TEXT,
  publicado_email    TEXT,
  publicado_en       INTEGER
);

CREATE TABLE contenido_versiones (
  clave          TEXT NOT NULL,
  version        INTEGER NOT NULL,
  valor          TEXT NOT NULL,
  -- publicada: la que está viva; reemplazada: fue publicada y ya no;
  -- pendiente: espera aprobación (no se ve en la tienda); descartada: la
  -- pendiente fue rechazada o reemplazada por otra solicitud.
  estado         TEXT NOT NULL CHECK (estado IN ('publicada', 'reemplazada', 'pendiente', 'descartada')),
  nota           TEXT,
  creado_por     TEXT NOT NULL,
  creado_email   TEXT,
  creado_en      INTEGER NOT NULL,
  -- Cuándo pasó a estar publicada (quien aprobó, si requería aprobación).
  publicado_en   INTEGER,
  aprobado_por   TEXT,
  -- Si esta versión es la restauración de otra.
  restaurada_de  INTEGER,
  PRIMARY KEY (clave, version)
);
CREATE INDEX contenido_versiones_estado_idx ON contenido_versiones (clave, estado);
