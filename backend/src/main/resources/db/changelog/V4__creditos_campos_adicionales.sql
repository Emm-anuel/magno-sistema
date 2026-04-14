-- =============================================================
-- V4: Campos adicionales para el flujo de evaluación y desembolso
-- =============================================================

ALTER TABLE creditos
    ADD COLUMN IF NOT EXISTS monto_aprobado     DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS observaciones      TEXT,
    ADD COLUMN IF NOT EXISTS fecha_aprobacion   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS aprobado_por       BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS fecha_desembolso   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS video_entrega_url  VARCHAR(500);
