-- Tabla principal del abono extraordinario
CREATE TABLE abonos_corriente (
    id                BIGSERIAL PRIMARY KEY,
    credito_id        BIGINT NOT NULL REFERENCES creditos(id),
    fecha             DATE NOT NULL,
    monto_total       DECIMAL(12,2) NOT NULL,
    monto_distribuido DECIMAL(12,2) NOT NULL,
    monto_sobrante    DECIMAL(12,2) NOT NULL,
    registrado_por_id BIGINT NOT NULL REFERENCES usuarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de cobertura por día
CREATE TABLE abono_coberturas (
    id                  BIGSERIAL PRIMARY KEY,
    abono_id            BIGINT NOT NULL REFERENCES abonos_corriente(id),
    calendario_pago_id  BIGINT NOT NULL REFERENCES calendario_pagos(id),
    numero_pago         INTEGER NOT NULL,
    monto_cuota         DECIMAL(12,2) NOT NULL,
    monto_multa         DECIMAL(12,2) NOT NULL,
    total_aplicado      DECIMAL(12,2) NOT NULL,
    es_parcial          BOOLEAN NOT NULL DEFAULT FALSE
);

-- FK en multas para registrar qué abono las cobró
ALTER TABLE multas ADD COLUMN cobrada_en_abono_id BIGINT REFERENCES abonos_corriente(id);

-- Los nuevos valores del enum se agregan en Java; PostgreSQL con varchar no necesita ALTER TYPE
-- (El campo estado en calendario_pagos es VARCHAR(20), no un tipo enum de Postgres)
