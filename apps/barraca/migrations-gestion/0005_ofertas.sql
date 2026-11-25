-- Ofertas con vigencia: precio de oferta que empieza y termina solo (cron de 30 min).
-- Una fila por código de producto. Los precios de las fichas viven en Supabase;
-- aquí solo va la programación y la foto de cómo estaban las fichas ANTES de
-- empezar y cómo las dejó la oferta (para devolverlas al terminar sin pisar
-- un cambio hecho por otra persona en el intertanto).
-- Tiempos en milisegundos desde epoch. Ver docs/MCP-NOTAS.md.

CREATE TABLE ofertas (
  id               TEXT PRIMARY KEY,
  -- Una llamada de programar_oferta crea varias filas con el mismo grupo.
  grupo_id         TEXT NOT NULL,
  codigo           TEXT NOT NULL,
  precio_oferta    INTEGER NOT NULL CHECK (precio_oferta > 0),
  inicio_en        INTEGER NOT NULL,
  fin_en           INTEGER NOT NULL CHECK (fin_en > inicio_en),
  -- activando / terminando = reclamada por una corrida del cron (si se cae a la mitad, otra la retoma).
  estado           TEXT NOT NULL DEFAULT 'programada'
                   CHECK (estado IN ('programada', 'activando', 'activa', 'terminando', 'terminada', 'cancelada', 'omitida')),
  -- 1 = Jorge ya aprobó el precio (bajo costo, margen, variación): no se vuelve a pedir al empezar.
  aprobada         INTEGER NOT NULL DEFAULT 0 CHECK (aprobada IN (0, 1)),
  reclamada_en     INTEGER,
  -- JSON: fichas [{id, precio, precio_original, en_oferta}] antes de empezar y como quedaron al empezar.
  antes            TEXT,
  aplicado         TEXT,
  -- Texto visible en ver_ofertas: por qué no se tocó una ficha o no se devolvió un precio.
  aviso            TEXT,
  nota             TEXT,
  usuario_id       TEXT NOT NULL,
  usuario_email    TEXT,
  creado_en        INTEGER NOT NULL,
  activada_en      INTEGER,
  terminada_en     INTEGER
);

CREATE INDEX ofertas_estado_inicio ON ofertas (estado, inicio_en);
CREATE INDEX ofertas_estado_fin ON ofertas (estado, fin_en);
CREATE INDEX ofertas_codigo ON ofertas (codigo, estado);
CREATE INDEX ofertas_grupo ON ofertas (grupo_id);
