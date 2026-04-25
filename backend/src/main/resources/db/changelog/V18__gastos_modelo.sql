-- =============================================================
-- MAGNO — V18: Módulo de Gastos — Modelo de datos
--
-- Tablas creadas:
--   categoria_gasto  — catálogo configurable de categorías por sucursal
--   gasto            — registro de gastos vinculados a un día de caja
--
-- Relaciones con tablas existentes:
--   categoria_gasto.sucursal_id → sucursales(id)          (V1)
--   gasto.caja_dia_id           → caja_dia(id)            (V16)
--   gasto.categoria_gasto_id    → categoria_gasto(id)
--   gasto.registrado_por        → usuarios(id)            (V1)
-- =============================================================

-- ------------------------------------------------------------------
-- 1. CATEGORÍA DE GASTO
--    Catálogo por sucursal de los conceptos de gasto permitidos.
--    Soft delete con campo activo (patrón de catálogos de config).
--    No se eliminan filas para no romper FK de gastos históricos.
-- ------------------------------------------------------------------
CREATE TABLE categoria_gasto (
    id              BIGSERIAL       PRIMARY KEY,
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    nombre          VARCHAR(150)    NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_categoria_gasto_nombre UNIQUE (sucursal_id, nombre)
);

CREATE INDEX idx_categoria_gasto_sucursal ON categoria_gasto(sucursal_id) WHERE activo = TRUE;

-- ------------------------------------------------------------------
-- 2. GASTO
--    Un registro por gasto realizado durante un día de caja.
--    Vinculado a caja_dia para que el cierre acumule el total.
--    Soft delete con deleted_at (tabla financiera — NUNCA borrar).
-- ------------------------------------------------------------------
CREATE TABLE gasto (
    id                  BIGSERIAL       PRIMARY KEY,
    caja_dia_id         BIGINT          NOT NULL REFERENCES caja_dia(id),
    categoria_gasto_id  BIGINT          NOT NULL REFERENCES categoria_gasto(id),

    -- Descripción libre que complementa la categoría
    concepto            TEXT            NOT NULL,

    monto               DECIMAL(12,2)   NOT NULL CHECK (monto > 0),

    registrado_por      BIGINT          NOT NULL REFERENCES usuarios(id),

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_gasto_caja_dia  ON gasto(caja_dia_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_gasto_categoria ON gasto(categoria_gasto_id);
