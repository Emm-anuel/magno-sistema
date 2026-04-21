-- MAGNO — V13: Flujo de desembolso en dos pasos para renovaciones
-- APROBADO = gerente dio el visto bueno; crédito anterior intacto.
-- ACTIVO   = efectivo entregado; crédito anterior RENOVADO, nuevo crédito generado.

-- 1. Monto aprobado (puede diferir del solicitado si el gerente lo ajustó)
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS monto_aprobado DECIMAL(12,2);

-- Backfill: registros existentes completados → monto_aprobado = monto_nuevo
UPDATE renovaciones SET monto_aprobado = monto_nuevo WHERE monto_aprobado IS NULL;

-- 2. Auditoría del confirmador de desembolso
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS confirmado_por     BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ;

-- 3. Registros existentes APROBADO con crédito nuevo ya creado → ACTIVO
--    (representan renovaciones completadas antes de V13; en el nuevo modelo son ACTIVO)
UPDATE renovaciones
SET estado = 'ACTIVO'
WHERE estado = 'APROBADO'
  AND credito_nuevo_id IS NOT NULL
  AND deleted_at IS NULL;
