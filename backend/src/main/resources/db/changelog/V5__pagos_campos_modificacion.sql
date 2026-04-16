-- =============================================================
-- V5: Campos de auditoria de modificacion para pagos
-- =============================================================

ALTER TABLE pagos
    ADD COLUMN IF NOT EXISTS modificado_por BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMPTZ;

