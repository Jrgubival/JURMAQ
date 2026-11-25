-- Textos editables de los correos al cliente y borradores de campañas (Etapa 2, 25-11-2026).
-- Detalle y reglas: docs/MCP-NOTAS.md ("Correos al cliente y campañas"). Tiempos en ms (INTEGER), JSON como TEXT.

-- Una fila por correo (clave de lib/correos-cliente/plantillas.ts). `publicado` es lo que usa el envío;
-- NULL = el correo sale con el texto del código. `borrador` es libre: nada lo envía.
CREATE TABLE correo_plantillas (
  clave              TEXT PRIMARY KEY,
  borrador           TEXT,
  borrador_por       TEXT,
  borrador_email     TEXT,
  borrador_en        INTEGER,
  publicado          TEXT,
  version_publicada  INTEGER,
  publicado_por      TEXT,
  publicado_email    TEXT,
  publicado_en       INTEGER
);

-- Historial: cada publicación queda como una versión nueva (nunca se edita una vieja).
-- La versión 0 no existe en la tabla: es el texto original del código.
CREATE TABLE correo_versiones (
  clave           TEXT NOT NULL,
  version         INTEGER NOT NULL,
  valor           TEXT NOT NULL,
  nota            TEXT,
  creado_por      TEXT NOT NULL,
  creado_email    TEXT,
  creado_en       INTEGER NOT NULL,
  -- Id de la aprobación de Jorge con la que se publicó.
  aprobacion_id   TEXT,
  PRIMARY KEY (clave, version)
);

-- Campañas a suscriptores: SOLO BORRADORES. No hay columna de estado a propósito: no existe un estado
-- "enviada" ni "programada", y ningún código de esta pieza envía ni dispara envíos.
CREATE TABLE campanas (
  id               TEXT PRIMARY KEY,
  asunto           TEXT NOT NULL,
  texto            TEXT NOT NULL,
  enlace           TEXT,
  segmento         TEXT,
  fecha_sugerida   TEXT,
  version          INTEGER NOT NULL DEFAULT 1,
  creado_por       TEXT NOT NULL,
  creado_email     TEXT,
  creado_en        INTEGER NOT NULL,
  actualizado_por  TEXT,
  actualizado_en   INTEGER NOT NULL,
  borrado_en       INTEGER,
  borrado_por      TEXT
);
CREATE INDEX campanas_vigentes_idx ON campanas (borrado_en, actualizado_en);

CREATE TABLE campana_versiones (
  campana_id   TEXT NOT NULL,
  version      INTEGER NOT NULL,
  valor        TEXT NOT NULL,
  creado_por   TEXT NOT NULL,
  creado_en    INTEGER NOT NULL,
  PRIMARY KEY (campana_id, version)
);
