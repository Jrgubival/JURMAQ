-- Cupones en el checkout: interruptor, reglas por cupón y reserva atómica de usos.
-- El cupón en sí (código, valor, vigencia) vive en Supabase (barraca_cupones);
-- aquí solo van las reglas nuevas, asociadas al id del cupón, y los usos.
-- Tiempos en milisegundos desde epoch. Las sentencias fallan fuerte si se aplican dos veces (ver docs/MCP-NOTAS.md).

-- Ajustes de la tienda (clave/valor). Hoy: "cupones_checkout" ('1' encendido).
-- Sin fila = apagado: los cupones no se aplican y el checkout queda como antes.
CREATE TABLE ajustes (
  clave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL,
  actualizado_en INTEGER NOT NULL,
  actualizado_por TEXT
);

-- Reglas nuevas de un cupón. Sin fila = sin restricciones (cupones antiguos).
CREATE TABLE cupon_reglas (
  cupon_id           TEXT PRIMARY KEY,
  categorias_modo    TEXT NOT NULL DEFAULT 'todas' CHECK (categorias_modo IN ('todas', 'incluir', 'excluir')),
  categorias_ids     TEXT NOT NULL DEFAULT '[]',
  -- 1 = un uso por cliente (correo y RUT normalizados) y SIN tope total.
  un_uso_por_cliente INTEGER NOT NULL DEFAULT 0 CHECK (un_uso_por_cliente IN (0, 1)),
  -- 1 = no se suma a productos con oferta, precio web rebajado, promoción de categoría ni combo.
  no_acumulable      INTEGER NOT NULL DEFAULT 0 CHECK (no_acumulable IN (0, 1)),
  actualizado_en     INTEGER NOT NULL,
  actualizado_por    TEXT
);

-- Un uso de un cupón en un pedido. Estados:
--   reservada  : tomada al crear el pedido; cuenta mientras no pase expira_en
--                (vencimiento perezoso: no hace falta ningún cron).
--   confirmada : el pedido se pagó (o la barraca confirmó la transferencia).
--   liberada   : el pedido se canceló, venció o no se pudo crear; ya no cuenta.
-- Los correos y RUT NO se guardan: solo su huella (SHA-256 del valor normalizado).
CREATE TABLE cupon_usos (
  id               TEXT PRIMARY KEY,
  cupon_id         TEXT NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('reservada', 'confirmada', 'liberada')),
  pedido_numero    TEXT,
  email_hash       TEXT NOT NULL,
  rut_hash         TEXT,
  descuento        INTEGER NOT NULL CHECK (descuento >= 0),
  monto_compra     INTEGER NOT NULL CHECK (monto_compra >= 0),
  metodo_pago      TEXT,
  creado_en        INTEGER NOT NULL,
  expira_en        INTEGER NOT NULL,
  confirmado_en    INTEGER,
  liberado_en      INTEGER,
  motivo_liberacion TEXT
);
CREATE UNIQUE INDEX cupon_usos_pedido_uq ON cupon_usos (pedido_numero) WHERE pedido_numero IS NOT NULL;
CREATE INDEX cupon_usos_cupon_idx  ON cupon_usos (cupon_id, estado, expira_en);
CREATE INDEX cupon_usos_email_idx  ON cupon_usos (cupon_id, email_hash);
CREATE INDEX cupon_usos_rut_idx    ON cupon_usos (cupon_id, rut_hash);
CREATE INDEX cupon_usos_creado_idx ON cupon_usos (creado_en);
