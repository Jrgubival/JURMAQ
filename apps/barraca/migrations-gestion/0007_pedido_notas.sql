-- Notas internas de pedidos (herramientas MCP de pedidos). Solo las ve el equipo;
-- el cliente nunca. No se editan: se agregan y se pueden "borrar" (deshacer), sin
-- eliminar la fila. Tiempos en milisegundos desde epoch.
CREATE TABLE pedido_notas (
  id           TEXT PRIMARY KEY,
  numero       TEXT NOT NULL,
  texto        TEXT NOT NULL,
  autor_id     TEXT NOT NULL,
  autor_email  TEXT,
  creada_en    INTEGER NOT NULL,
  borrada_en   INTEGER,
  borrada_por  TEXT
);

CREATE INDEX pedido_notas_numero_idx ON pedido_notas (numero, creada_en);
