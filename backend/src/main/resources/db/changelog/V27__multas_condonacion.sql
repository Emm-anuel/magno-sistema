-- =============================================================
-- MAGNO — V27: Condonación de multas en renovaciones
--
-- Agrega campos de condonación a la tabla multas y un campo
-- de resumen multas_condonadas a la tabla renovaciones.
-- Una multa no puede ser cobrada Y condonada al mismo tiempo
-- (constraint de negocio, validado en servicio).
-- =============================================================

-- Columnas de condonación en multas
ALTER TABLE multas ADD COLUMN condonada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE multas ADD COLUMN condonada_en_renovacion_id BIGINT REFERENCES renovaciones(id);
ALTER TABLE multas ADD COLUMN condonada_por_id BIGINT REFERENCES usuarios(id);
ALTER TABLE multas ADD COLUMN fecha_condonacion TIMESTAMPTZ;
ALTER TABLE multas ADD COLUMN motivo_condonacion TEXT;

-- Índices para queries de auditoría y caja
CREATE INDEX idx_multas_condonada ON multas(condonada) WHERE condonada = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_multas_condonada_por_renovacion ON multas(condonada_en_renovacion_id) WHERE condonada_en_renovacion_id IS NOT NULL;

-- Resumen de condonadas en renovaciones (para queries eficientes en caja)
ALTER TABLE renovaciones ADD COLUMN multas_condonadas DECIMAL(12,2) NOT NULL DEFAULT 0;
