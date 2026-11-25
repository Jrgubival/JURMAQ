-- Dinero y borrado por MCP (Parte B, 25-11-2026). Detalle: docs/MCP-NOTAS.md, "Parte B: dinero y borrado".
-- Tiempos en ms (INTEGER). NO guarda datos personales: solo número de pedido, estados y montos.

-- Pedidos archivados: salen de las listas y reportes, se recuperan con desarchivar_pedido.
-- El pedido en Supabase NO se toca (no cambia el esquema de Supabase). Clave primaria = el número.
CREATE TABLE pedidos_archivados (
  numero              TEXT PRIMARY KEY,
  estado_al_archivar  TEXT NOT NULL,
  archivado_en        INTEGER NOT NULL,
  archivado_por       TEXT NOT NULL
);
CREATE INDEX pedidos_archivados_en_idx ON pedidos_archivados (archivado_en);

-- Reserva EXCLUSIVA de la devolución de un pedido hecha por MCP: una sola fila por pedido, para siempre
-- (la clave primaria impide dos devoluciones del mismo pedido aunque lleguen a la vez o se reintente).
-- Estados:
--   devolucion_reservada   : tomada la reserva, aún no se canceló el pedido.
--   devolucion_en_curso    : el pedido ya está cancelado y se está pidiendo la devolución (Webpay) o registrando.
--   devolucion_hecha       : Webpay confirmó la devolución.
--   devolucion_rechazada   : Webpay respondió que NO devolvió (error definitivo); se reintenta solo desde el panel.
--   devolucion_incierta    : falló la red o el tiempo y no se sabe si Webpay devolvió. BLOQUEA todo reintento automático.
--   transferencia_pendiente: pago por transferencia; la devolución queda pendiente en el panel (la cuenta y el "hecha" son del panel).
CREATE TABLE devoluciones_mcp (
  numero          TEXT PRIMARY KEY,
  estado          TEXT NOT NULL CHECK (estado IN ('devolucion_reservada', 'devolucion_en_curso', 'devolucion_hecha', 'devolucion_rechazada', 'devolucion_incierta', 'transferencia_pendiente')),
  medio           TEXT NOT NULL CHECK (medio IN ('webpay', 'transferencia')),
  monto           INTEGER NOT NULL CHECK (monto > 0),
  usuario_id      TEXT NOT NULL,
  lote_id         TEXT,
  creado_en       INTEGER NOT NULL,
  actualizado_en  INTEGER NOT NULL,
  detalle         TEXT
);
