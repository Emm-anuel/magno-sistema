-- =============================================================
-- MAGNO — V16: Módulo de Caja — Modelo de datos
--
-- Reemplaza lógicamente aperturas_caja + cortes_caja (V1) con
-- un diseño unificado. Las tablas antiguas se mantienen hasta
-- que el backend migre completamente.
--
-- Tablas creadas:
--   caja_dia                  — apertura/cierre por sucursal/día
--   caja_movimiento_inversion — entradas y salidas extraordinarias
-- =============================================================

-- ------------------------------------------------------------------
-- 1. CAJA DÍA
--    Un registro por sucursal por día hábil. Concentra apertura y
--    cierre, los campos calculados se rellenan en el momento del
--    cierre (NULL mientras la caja está abierta).
-- ------------------------------------------------------------------
CREATE TABLE caja_dia (
    id                      BIGSERIAL       PRIMARY KEY,

    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),

    -- Fecha del día operativo (no timestamp — un día por sucursal)
    fecha                   DATE            NOT NULL,

    estado                  VARCHAR(10)     NOT NULL DEFAULT 'ABIERTA'
                                CHECK (estado IN ('ABIERTA', 'CERRADA')),

    -- ── Apertura ──────────────────────────────────────────────
    monto_apertura          DECIMAL(12,2)   NOT NULL,
    concepto_apertura       VARCHAR(255),

    abierta_por             BIGINT          NOT NULL REFERENCES usuarios(id),
    fecha_hora_apertura     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- ── Cierre (NULL mientras la caja está ABIERTA) ───────────
    cerrada_por             BIGINT          REFERENCES usuarios(id),
    fecha_hora_cierre       TIMESTAMPTZ,

    -- Suma de cobros del día (todos los pagos de carteras)
    ingreso_carteras        DECIMAL(12,2),

    -- Total de desembolsos del día (créditos nuevos + renovaciones)
    desembolsos             DECIMAL(12,2),

    -- monto_apertura + ingreso_carteras − desembolsos + suma de movimientos
    subtotal_caja           DECIMAL(12,2),

    -- porcentaje_ahorro (config_sucursal) × ingreso_carteras
    monto_libres            DECIMAL(12,2),

    -- Snapshot de config_sucursal.monto_ahorro_fijo al momento del cierre
    ahorro_fijo             DECIMAL(12,2),

    -- monto_libres − ahorro_fijo
    total_real_libres       DECIMAL(12,2),

    -- ── Auditoría ─────────────────────────────────────────────
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Una sola caja por sucursal por día hábil
    CONSTRAINT uq_caja_sucursal_fecha UNIQUE (sucursal_id, fecha)
);

CREATE INDEX idx_caja_dia_sucursal_fecha ON caja_dia(sucursal_id, fecha DESC);
CREATE INDEX idx_caja_dia_estado         ON caja_dia(estado) WHERE estado = 'ABIERTA';

-- ------------------------------------------------------------------
-- 2. CAJA MOVIMIENTO INVERSIÓN
--    Entradas y salidas extraordinarias asociadas a un día de caja.
--    monto > 0 = entrada de efectivo
--    monto < 0 = salida de efectivo
--    El concepto proviene del catálogo conceptos_inversion (V15).
-- ------------------------------------------------------------------
CREATE TABLE caja_movimiento_inversion (
    id                      BIGSERIAL       PRIMARY KEY,

    caja_dia_id             BIGINT          NOT NULL REFERENCES caja_dia(id),
    concepto_inversion_id   BIGINT          NOT NULL REFERENCES conceptos_inversion(id),

    -- Descripción libre adicional al concepto (opcional)
    descripcion             VARCHAR(255),

    -- Positivo = entrada, negativo = salida
    monto                   DECIMAL(12,2)   NOT NULL,

    registrado_por          BIGINT          NOT NULL REFERENCES usuarios(id),

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caja_mov_inv_caja_dia ON caja_movimiento_inversion(caja_dia_id);
