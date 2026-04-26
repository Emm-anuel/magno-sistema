-- =============================================================
-- MAGNO — V23: nomina_pago
--
-- Registra el pago semanal de nómina vinculado a un día de caja.
-- total_nomina en caja_dia: snapshot al momento del cierre
-- (mismo patrón que total_gastos — nullable, se fija al cerrar).
-- =============================================================

-- Columna en caja_dia (nullable, se fija al cerrar igual que total_gastos)
ALTER TABLE caja_dia
    ADD COLUMN total_nomina DECIMAL(12,2);

-- Tabla de registro de pagos de nómina
CREATE TABLE nomina_pago (
    id              BIGSERIAL       PRIMARY KEY,
    caja_dia_id     BIGINT          NOT NULL REFERENCES caja_dia(id),
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    total_pagado    DECIMAL(12,2)   NOT NULL CHECK (total_pagado > 0),
    registrado_por  BIGINT          NOT NULL REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Índice parcial: garantiza un solo pago activo por día de caja
CREATE UNIQUE INDEX uq_nomina_pago_caja_dia_activo
    ON nomina_pago(caja_dia_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_nomina_pago_caja_dia
    ON nomina_pago(caja_dia_id);
