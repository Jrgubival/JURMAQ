-- Conexión de Claude (MCP): OAuth, límites de uso y aprobaciones por correo.
-- Base D1 "jurmaq-barraca-gestion" (binding GESTION_DB). Ver docs/MCP-NOTAS.md.
-- Tiempos en milisegundos desde epoch (INTEGER). JSON como TEXT.
-- Nada de esto guarda un secreto en claro: códigos, tokens y enlaces se guardan
-- solo como hash SHA-256.

-- Programas que se registraron para conectarse (registro dinámico, RFC 7591).
-- Son clientes públicos: sin secreto, la seguridad la da PKCE.
CREATE TABLE oauth_clientes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,           -- JSON: lista de redirect_uri registradas
  creado_en     INTEGER NOT NULL,
  ip_hash       TEXT
);
CREATE INDEX oauth_clientes_creado_idx ON oauth_clientes (creado_en);

-- Código de autorización: un solo uso, vida de 60 segundos.
CREATE TABLE oauth_codigos (
  codigo_hash    TEXT PRIMARY KEY,
  cliente_id     TEXT NOT NULL,
  usuario_id     TEXT NOT NULL,
  usuario_email  TEXT,
  redirect_uri   TEXT NOT NULL,
  code_challenge TEXT NOT NULL,          -- S256
  scope          TEXT NOT NULL,
  resource       TEXT NOT NULL,
  creado_en      INTEGER NOT NULL,
  expira_en      INTEGER NOT NULL,
  usado_en       INTEGER
);
CREATE INDEX oauth_codigos_expira_idx ON oauth_codigos (expira_en);

-- Un par acceso/refresco por fila. Una "conexión" es una familia: todas las
-- filas que nacieron del mismo código, una tras otra por rotación del refresco.
-- Si se vuelve a usar un refresco ya rotado, se revoca la familia entera.
CREATE TABLE oauth_tokens (
  id                TEXT PRIMARY KEY,
  familia_id        TEXT NOT NULL,
  cliente_id        TEXT NOT NULL,
  usuario_id        TEXT NOT NULL,
  usuario_email     TEXT,
  scope             TEXT NOT NULL,
  resource          TEXT NOT NULL,
  codigo_hash       TEXT,                -- código del que nació (solo la primera fila)
  access_hash       TEXT NOT NULL UNIQUE,
  access_expira_en  INTEGER NOT NULL,
  refresh_hash      TEXT NOT NULL UNIQUE,
  refresh_expira_en INTEGER NOT NULL,
  creado_en         INTEGER NOT NULL,
  familia_creada_en INTEGER NOT NULL,    -- tope absoluto de vida de la conexión
  ultimo_uso        INTEGER,
  rotado_en         INTEGER,             -- el refresco de esta fila ya se canjeó
  revocado_en       INTEGER,
  revocado_motivo   TEXT
);
CREATE INDEX oauth_tokens_familia_idx ON oauth_tokens (familia_id);
CREATE INDEX oauth_tokens_usuario_idx ON oauth_tokens (usuario_id, revocado_en);
CREATE INDEX oauth_tokens_codigo_idx  ON oauth_tokens (codigo_hash);

-- Límite de uso: contador por ventana fija. D1 y no KV: ya está enlazada (sin
-- crear recursos nuevos) y un UPSERT es atómico; KV es eventualmente consistente.
CREATE TABLE mcp_limites (
  clave   TEXT NOT NULL,
  ventana INTEGER NOT NULL,              -- inicio de la ventana (ms)
  cuenta  INTEGER NOT NULL,
  PRIMARY KEY (clave, ventana)
);

-- Aprobaciones: cambios riesgosos que esperan el visto bueno de Jorge por correo.
-- `huella` liga la solicitud al contenido exacto del cambio: si los datos
-- cambian, la aprobación deja de servir. El enlace del correo se guarda hasheado.
CREATE TABLE aprobaciones (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  usuario_id     TEXT NOT NULL,
  usuario_email  TEXT,
  herramienta    TEXT NOT NULL,
  motivos        TEXT NOT NULL,          -- JSON: lista de motivos
  resumen        TEXT NOT NULL,          -- texto simple que se muestra y se envía
  detalle        TEXT,                   -- JSON mínimo del cambio (tope 64 KB)
  huella         TEXT NOT NULL,
  estado         TEXT NOT NULL,          -- pendiente | aprobada | rechazada | usada
  creado_en      INTEGER NOT NULL,
  expira_en      INTEGER NOT NULL,
  resuelto_en    INTEGER,
  usada_en       INTEGER
);
CREATE INDEX aprobaciones_usuario_idx ON aprobaciones (usuario_id, creado_en);
CREATE INDEX aprobaciones_estado_idx  ON aprobaciones (estado, expira_en);

-- Acumulado en 24 h por usuario: dividir un cambio grande en varios chicos no
-- evade el umbral. Una fila por producto tocado y por cambio.
CREATE TABLE cambios_acumulados (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL,
  clave         TEXT NOT NULL,           -- producto (código) tocado
  variacion_pct REAL NOT NULL,           -- variación absoluta de precio, en %
  aprobado      INTEGER NOT NULL DEFAULT 0, -- 1 = ya lo vio y aprobó Jorge: no cuenta para el umbral
  creado_en     INTEGER NOT NULL
);
CREATE INDEX cambios_acumulados_usuario_idx ON cambios_acumulados (usuario_id, creado_en);
