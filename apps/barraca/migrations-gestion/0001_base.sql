-- Gestión de la tienda (MCP + panel): tablas base compartidas.
-- Base D1 "jurmaq-barraca-gestion", binding GESTION_DB (ver wrangler.jsonc).
-- Tiempos en milisegundos desde epoch (INTEGER). JSON como TEXT.
-- Numeración: ver docs/MCP-NOTAS.md ("Migraciones D1"). Nunca editar una
-- migración ya aplicada: se agrega una nueva con el siguiente número.

-- Registro de cada cambio hecho por una herramienta de gestión. Un "lote" agrupa
-- los cambios de una misma operación (p. ej. 40 precios de una sola orden) y se
-- deshace completo. `antes`/`despues` guardan lo mínimo para revertir.
CREATE TABLE auditoria (
  id            TEXT PRIMARY KEY,
  lote_id       TEXT NOT NULL,
  usuario_id    TEXT NOT NULL,
  usuario_email TEXT,
  herramienta   TEXT NOT NULL,
  entidad       TEXT NOT NULL,
  entidad_id    TEXT NOT NULL,
  antes         TEXT,
  despues       TEXT,
  creado_en     INTEGER NOT NULL,
  deshecho_en   INTEGER,
  deshecho_por  TEXT
);
CREATE INDEX auditoria_lote_idx    ON auditoria (lote_id);
CREATE INDEX auditoria_entidad_idx ON auditoria (entidad, entidad_id, creado_en);
CREATE INDEX auditoria_creado_idx  ON auditoria (creado_en);

-- Vista previa de un solo uso: "esto es lo que voy a cambiar, confírmalo".
-- El id corto lo recibe quien confirma; solo sirve para el mismo usuario, antes
-- de `expira_en` y una vez. `huella` es el SHA-256 de los datos que se vieron:
-- si al confirmar cambiaron, se rechaza.
CREATE TABLE vistas_previas (
  id         TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  huella     TEXT,
  creado_en  INTEGER NOT NULL,
  expira_en  INTEGER NOT NULL,
  usada_en   INTEGER
);
CREATE INDEX vistas_previas_usuario_idx ON vistas_previas (usuario_id, creado_en);
CREATE INDEX vistas_previas_expira_idx  ON vistas_previas (expira_en);
