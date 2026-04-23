-- =============================================================
-- MAGNO — V15: Módulo de Administración
-- Tablas de configuración por sucursal, nómina, conceptos de
-- inversión y bitácora de cambios de configuración.
--
-- Tablas ya existentes (NO se tocan):
--   config_multas   → V1 + V14
--   dias_festivos   → V1
--   bitacora        → V1
-- =============================================================

-- ------------------------------------------------------------------
-- 1. CONFIGURACIÓN GENERAL POR SUCURSAL
--    Una fila por sucursal. Almacena parámetros operativos que
--    no tienen tabla propia: hora de corte, ahorro y nómina.
-- ------------------------------------------------------------------
CREATE TABLE config_sucursal (
    id                      BIGSERIAL       PRIMARY KEY,
    sucursal_id             BIGINT          NOT NULL UNIQUE REFERENCES sucursales(id),

    -- Hora límite de operación para ASESOR_COBRADOR y SUPERVISOR_CAMPO.
    -- El enforcement se implementa en Módulo 6 (Caja).
    hora_limite_operacion   TIME            NOT NULL DEFAULT '17:00:00',

    -- Ahorro: porcentaje sobre ingreso de carteras (24 % → 0.2400)
    porcentaje_ahorro       DECIMAL(5,4)    NOT NULL DEFAULT 0.2400,

    -- Ahorro fijo diario adicional (pendiente confirmar con cliente, default 0)
    monto_ahorro_fijo       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

    -- Día de la semana en que se paga la nómina
    dia_pago_nomina         VARCHAR(10)     NOT NULL DEFAULT 'JUEVES'
                                CHECK (dia_pago_nomina IN ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES')),

    updated_by              BIGINT          REFERENCES usuarios(id),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- 2. RANGOS DE CRÉDITO POR SUCURSAL
--    Reemplaza los valores hardcodeados en CreditoCalculoService.
--    Una fila por rango-sucursal-tipo_pago.
--
--    Diarios iniciales:
--      [$1k – $14,999]  → 25 días, 30%
--      [$15k – $19,999] → 25 días, 24%
--      [$20k – $50k]    → 30 días, 24%
--    Semanales iniciales:
--      [$2k – $9,999]   → 8 semanas, 40%
--      [$10k – $30k]    → 12 semanas, 40%
-- ------------------------------------------------------------------
CREATE TABLE config_rangos_credito (
    id              BIGSERIAL       PRIMARY KEY,
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    tipo_pago       VARCHAR(10)     NOT NULL CHECK (tipo_pago IN ('DIARIO','SEMANAL')),

    -- Rango de monto capital al que aplica este producto
    rango_min       DECIMAL(12,2)   NOT NULL,
    rango_max       DECIMAL(12,2)   NOT NULL,

    -- Plazo: días hábiles para DIARIO, semanas para SEMANAL
    plazo           INTEGER         NOT NULL,

    -- Tasa de interés sobre el capital (0.30 = 30 %)
    tasa_interes    DECIMAL(5,4)    NOT NULL,

    updated_by      BIGINT          REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_rango_credito_valido CHECK (rango_max > rango_min),
    CONSTRAINT uq_config_rango UNIQUE (sucursal_id, tipo_pago, rango_min)
);

CREATE INDEX idx_config_rangos_sucursal ON config_rangos_credito(sucursal_id, tipo_pago);

-- ------------------------------------------------------------------
-- 3. UMBRALES DE RENOVACIÓN POR SUCURSAL
--    Reemplaza los valores hardcodeados en RenovacionService.
--    Una fila por (sucursal, tipo_pago, plazo).
--
--    Iniciales:
--      DIARIO  plazo=25 → umbral 16
--      DIARIO  plazo=30 → umbral 19
--      SEMANAL plazo=8  → umbral 5
--      SEMANAL plazo=12 → umbral 9
-- ------------------------------------------------------------------
CREATE TABLE config_umbrales_renovacion (
    id              BIGSERIAL       PRIMARY KEY,
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    tipo_pago       VARCHAR(10)     NOT NULL CHECK (tipo_pago IN ('DIARIO','SEMANAL')),

    -- Plazo del crédito al que aplica este umbral
    plazo           INTEGER         NOT NULL,

    -- Número mínimo de pagos realizados para ser elegible a renovar
    umbral_pagos    INTEGER         NOT NULL,

    updated_by      BIGINT          REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_config_umbral UNIQUE (sucursal_id, tipo_pago, plazo)
);

-- ------------------------------------------------------------------
-- 4. NÓMINA DE PERSONAL POR SUCURSAL
--    Lista configurable de personal (incluye externos al sistema).
--    Soft delete: deleted_at.
-- ------------------------------------------------------------------
CREATE TABLE nomina_personal (
    id              BIGSERIAL       PRIMARY KEY,
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    nombre          VARCHAR(150)    NOT NULL,
    puesto          VARCHAR(100)    NOT NULL,
    monto_semanal   DECIMAL(12,2)   NOT NULL,

    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      BIGINT          REFERENCES usuarios(id),
    updated_by      BIGINT          REFERENCES usuarios(id)
);

CREATE INDEX idx_nomina_sucursal ON nomina_personal(sucursal_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------
-- 5. CONCEPTOS DE INVERSIÓN POR SUCURSAL
--    Lista de etiquetas predefinidas para movimientos de caja.
--    Evita texto libre inconsistente al registrar inversiones.
--    Soft delete: deleted_at.
-- ------------------------------------------------------------------
CREATE TABLE conceptos_inversion (
    id              BIGSERIAL       PRIMARY KEY,
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    nombre          VARCHAR(150)    NOT NULL,

    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      BIGINT          REFERENCES usuarios(id),
    updated_by      BIGINT          REFERENCES usuarios(id),

    CONSTRAINT uq_concepto_sucursal UNIQUE (sucursal_id, nombre)
);

-- ------------------------------------------------------------------
-- 6. BITÁCORA DE CAMBIOS DE CONFIGURACIÓN
--    Registro inmutable de cada modificación realizada en el
--    módulo de Administración. Una fila por campo modificado.
--    La tabla `bitacora` existente no tiene valor_anterior / valor_nuevo
--    ni el campo seccion, por eso se crea una tabla dedicada.
-- ------------------------------------------------------------------
CREATE TABLE bitacora_config (
    id              BIGSERIAL       PRIMARY KEY,

    -- Quién hizo el cambio
    usuario_id      BIGINT          REFERENCES usuarios(id),

    -- Sucursal afectada; NULL = cambio global (ej: días inhábiles)
    sucursal_id     BIGINT          REFERENCES sucursales(id),

    -- Sección del módulo: MULTAS | RANGOS_CREDITO | UMBRALES_RENOVACION |
    --   CONFIG_GENERAL | AHORRO | NOMINA | CONCEPTOS | DIAS_INHABILES
    seccion         VARCHAR(50)     NOT NULL,

    -- Campo específico que cambió (ej: "multa_no_pago", "hora_limite_operacion")
    campo           VARCHAR(100)    NOT NULL,

    valor_anterior  TEXT,
    valor_nuevo     TEXT,

    -- Inmutable — sin updated_at ni deleted_at
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bitacora_config_fecha     ON bitacora_config(created_at DESC);
CREATE INDEX idx_bitacora_config_sucursal  ON bitacora_config(sucursal_id);
CREATE INDEX idx_bitacora_config_usuario   ON bitacora_config(usuario_id);
CREATE INDEX idx_bitacora_config_seccion   ON bitacora_config(seccion);
