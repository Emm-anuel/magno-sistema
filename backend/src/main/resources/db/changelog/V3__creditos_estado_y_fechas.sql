-- =============================================================
-- V3: Preparar tabla creditos para flujo SOLICITADO → APROBADO → ACTIVO
-- =============================================================

-- 1) Ampliar el CHECK constraint de estado para incluir nuevos estados
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_estado_check;

ALTER TABLE creditos
    ADD CONSTRAINT creditos_estado_check
    CHECK (estado IN ('SOLICITADO','APROBADO','ACTIVO','PAGADO','RENOVADO','CANCELADO'));

-- Cambiar el DEFAULT al estado inicial del workflow
ALTER TABLE creditos ALTER COLUMN estado SET DEFAULT 'SOLICITADO';

-- 2) Hacer nullable fecha_inicio y fecha_vencimiento:
--    Se calculan y asignan al activar el crédito (PATCH /activar).
--    En SOLICITADO y APROBADO aún no se conocen.
ALTER TABLE creditos ALTER COLUMN fecha_inicio     DROP NOT NULL;
ALTER TABLE creditos ALTER COLUMN fecha_vencimiento DROP NOT NULL;
