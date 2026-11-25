-- Avisos por correo a Jorge (Parte B, base, 25-11-2026). Detalle: docs/MCP-NOTAS.md, "Parte B, base".
-- Tiempos en ms (INTEGER), JSON como TEXT.
--
-- Una fila por aviso. Dos tipos:
--   'cambio' = en modo de aprobación `avisar`: un cambio riesgoso se aplicó sin esperar el OK y se le avisa a Jorge.
--   'dinero' = toda operación de dinero o borrado (en ambos modos): el aviso se REGISTRA ANTES de ejecutar la
--              operación y el correo sale después; si el correo falla se reintenta desde el cron de 30 minutos.
-- NO guarda RUT, correo, teléfono ni cuenta de clientes: solo nombre de pila, número de pedido, monto y medio.
CREATE TABLE avisos_operacion (
  id                 TEXT PRIMARY KEY,
  tipo               TEXT NOT NULL,            -- cambio | dinero
  estado             TEXT NOT NULL,            -- pendiente | enviando | enviado | fallido | cancelado
  usuario_id         TEXT NOT NULL,
  usuario_email      TEXT,
  herramienta        TEXT NOT NULL,
  operacion          TEXT NOT NULL,            -- título corto de lo hecho
  resumen            TEXT NOT NULL,            -- texto simple, sin datos personales
  detalle            TEXT,                     -- JSON: motivos, cifras, mayores variaciones...
  aprobacion_id      TEXT,                     -- 'cambio': la aprobación automática que lo originó
  pedido_numero      TEXT,
  cliente_nombre     TEXT,                     -- solo nombre de pila
  monto              INTEGER,
  medio              TEXT,
  resultado          TEXT,                     -- ok | error | NULL (aún no se sabe)
  lote_id            TEXT,
  creado_en          INTEGER NOT NULL,
  actualizado_en     INTEGER NOT NULL,
  enviado_en         INTEGER,
  intentos           INTEGER NOT NULL DEFAULT 0,
  ultimo_error       TEXT,                     -- código corto, nunca un mensaje con datos
  proximo_intento_en INTEGER
);
CREATE INDEX avisos_operacion_aprobacion_idx ON avisos_operacion (aprobacion_id) WHERE aprobacion_id IS NOT NULL;
CREATE INDEX avisos_operacion_estado_idx ON avisos_operacion (estado, creado_en);
