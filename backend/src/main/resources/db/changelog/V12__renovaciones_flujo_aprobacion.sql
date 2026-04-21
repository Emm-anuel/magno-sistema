-- MAGNO — V12: Flujo de aprobación para renovaciones + discriminador tipo en créditos
-- Motivo: Renovaciones ahora pasan por SOLICITADO → APROBADO/RECHAZADO igual que Créditos Nuevos.

-- ── 1. Discriminador de tipo en créditos ────────────────────────────────────
ALTER TABLE creditos
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'NUEVO';

-- Retroactivamente marcar créditos generados por renovaciones ya procesadas
UPDATE creditos c
SET tipo = 'RENOVACION'
WHERE EXISTS (
    SELECT 1 FROM renovaciones r WHERE r.credito_nuevo_id = c.id
);

-- ── 2. Campos adicionales en renovaciones ───────────────────────────────────

-- monto y tipo_pago solicitados (necesarios para crear el crédito al aprobar)
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS monto_nuevo  DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS tipo_pago    VARCHAR(10);

-- Backfill desde el creditoNuevo de registros existentes
UPDATE renovaciones r
SET
    monto_nuevo = (SELECT c.monto_capital FROM creditos c WHERE c.id = r.credito_nuevo_id),
    tipo_pago   = (SELECT c.tipo_pago   FROM creditos c WHERE c.id = r.credito_nuevo_id)
WHERE r.credito_nuevo_id IS NOT NULL
  AND (r.monto_nuevo IS NULL OR r.tipo_pago IS NULL);

-- Asegurar NOT NULL después del backfill
ALTER TABLE renovaciones ALTER COLUMN monto_nuevo SET NOT NULL;
ALTER TABLE renovaciones ALTER COLUMN tipo_pago   SET NOT NULL;

-- ── 3. Estado de la renovación ───────────────────────────────────────────────
-- Registros existentes = ya procesados → APROBADO
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'APROBADO';

-- ── 4. Campos de aprobación / rechazo ────────────────────────────────────────
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS aprobado_por      BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS fecha_aprobacion  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS motivo_rechazo    TEXT;

-- ── 5. Hacer credito_nuevo_id nullable ───────────────────────────────────────
-- En el nuevo flujo, creditoNuevo se crea al aprobar, no al solicitar.
ALTER TABLE renovaciones
    ALTER COLUMN credito_nuevo_id DROP NOT NULL;
