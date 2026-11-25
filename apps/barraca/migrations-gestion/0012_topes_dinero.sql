-- Topes duros de VOLUMEN de las operaciones de dinero y borrado por MCP (correcciones de auditoría, 25-11-2026).
-- Detalle: docs/MCP-NOTAS.md, "Correcciones de la auditoría de la Parte B". Tiempos en ms (INTEGER).
-- Una fila por operación RESERVADA (se anota antes de ejecutarla, así dos llamadas a la vez no pasan el tope).
-- NO guarda datos personales: solo quién (id de usuario), qué herramienta, si fue una devolución y el monto.
-- Los valores de los topes viven en el código (src/lib/mcp/topes-dinero.ts), nunca en esta tabla ni en una herramienta.
CREATE TABLE operaciones_dinero (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL,
  herramienta   TEXT NOT NULL,
  es_devolucion INTEGER NOT NULL DEFAULT 0 CHECK (es_devolucion IN (0, 1)),
  monto         INTEGER NOT NULL DEFAULT 0 CHECK (monto >= 0),
  creado_en     INTEGER NOT NULL
);
CREATE INDEX operaciones_dinero_usuario_idx ON operaciones_dinero (usuario_id, creado_en);
