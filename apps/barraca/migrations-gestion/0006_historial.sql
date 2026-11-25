-- Historial de cambios (herramienta ver_historial): índice para listar lotes por
-- usuario, de lo más nuevo a lo más antiguo. Las herramientas de contenido, cupones,
-- opiniones e historial no necesitan tablas nuevas: reusan auditoria, vistas_previas,
-- aprobaciones, contenido, cupon_reglas y ajustes.
CREATE INDEX auditoria_usuario_idx ON auditoria (usuario_id, creado_en);
