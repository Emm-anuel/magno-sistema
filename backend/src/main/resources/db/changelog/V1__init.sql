-- =============================================================
-- MAGNO Sistema de Cobros — Schema inicial
-- Liquibase changeset: V1__init.sql
-- Convenciones:
--   - Todos los montos: DECIMAL(12,2)
--   - Archivos: solo URL VARCHAR, nunca bytes
--   - Soft delete: deleted_at TIMESTAMPTZ (tablas financieras)
--   - Timestamps: TIMESTAMPTZ (con zona horaria)
-- =============================================================

-- ------------------------------------------------------------------
-- EXTENSIONES
-- ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------
-- SUCURSALES
-- ------------------------------------------------------------------
CREATE TABLE sucursales (
    id                  BIGSERIAL       PRIMARY KEY,
    nombre              VARCHAR(100)    NOT NULL,
    direccion           VARCHAR(255),
    telefono            VARCHAR(20),
    responsable_id      BIGINT,                         -- FK a usuarios (circular, se agrega después)
    multa_base          DECIMAL(12,2)   NOT NULL DEFAULT 50.00,
    ahorro_diario       DECIMAL(12,2)   NOT NULL DEFAULT 2000.00,
    activa              BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- ROLES
-- ------------------------------------------------------------------
CREATE TABLE roles (
    id      BIGSERIAL       PRIMARY KEY,
    nombre  VARCHAR(50)     NOT NULL UNIQUE
);

INSERT INTO roles (nombre) VALUES
    ('ADMINISTRADOR'),
    ('SUPERVISOR'),
    ('SUPERVISOR_CAMPO'),
    ('ASESOR_COBRADOR');

-- ------------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------------
CREATE TABLE usuarios (
    id                  BIGSERIAL       PRIMARY KEY,
    nombre_completo     VARCHAR(150)    NOT NULL,
    email               VARCHAR(150)    NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,
    telefono            VARCHAR(20)     NOT NULL,
    rol_id              BIGINT          NOT NULL REFERENCES roles(id),
    sucursal_id         BIGINT          NOT NULL REFERENCES sucursales(id),

    -- Domicilio
    calle               VARCHAR(150)    NOT NULL,
    no_exterior         VARCHAR(20)     NOT NULL,
    no_interior         VARCHAR(20),
    colonia             VARCHAR(100)    NOT NULL,
    municipio           VARCHAR(100)    NOT NULL,
    estado              VARCHAR(100)    NOT NULL,
    codigo_postal       VARCHAR(10)     NOT NULL,

    -- Identificación
    ine_numero          VARCHAR(50)     NOT NULL,
    ine_imagen_url      VARCHAR(500),               -- URL S3 (magno/usuarios-ine/{id}/)

    -- Referencias personales
    ref1_nombre         VARCHAR(150)    NOT NULL,
    ref1_telefono       VARCHAR(20)     NOT NULL,
    ref1_parentesco     VARCHAR(50)     NOT NULL,
    ref2_nombre         VARCHAR(150)    NOT NULL,
    ref2_telefono       VARCHAR(20)     NOT NULL,
    ref2_parentesco     VARCHAR(50)     NOT NULL,

    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          BIGINT          REFERENCES usuarios(id)
);

-- Completar FK circular en sucursales
ALTER TABLE sucursales
    ADD CONSTRAINT fk_sucursales_responsable
    FOREIGN KEY (responsable_id) REFERENCES usuarios(id);

-- ------------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------------
CREATE TABLE clientes (
    id                      BIGSERIAL       PRIMARY KEY,

    -- Datos personales
    nombre                  VARCHAR(100)    NOT NULL,
    apellido_paterno        VARCHAR(100)    NOT NULL,
    apellido_materno        VARCHAR(100),
    fecha_nacimiento        DATE            NOT NULL,
    genero                  VARCHAR(20),
    estado_civil            VARCHAR(20)     NOT NULL,   -- SOLTERO, CASADO, UNION_LIBRE
    nombre_conyuge          VARCHAR(150),
    telefono_fijo           VARCHAR(20),
    celular                 VARCHAR(20)     NOT NULL,

    -- Identificación
    ine_tipo                VARCHAR(50),
    ine_numero              VARCHAR(50)     NOT NULL,
    curp                    VARCHAR(18)     NOT NULL,
    rfc                     VARCHAR(13),

    -- Domicilio
    dom_calle               VARCHAR(150)    NOT NULL,
    dom_no_exterior         VARCHAR(20)     NOT NULL,
    dom_no_interior         VARCHAR(20),
    dom_colonia             VARCHAR(100)    NOT NULL,
    dom_municipio           VARCHAR(100)    NOT NULL,
    dom_estado              VARCHAR(100)    NOT NULL,
    dom_codigo_postal       VARCHAR(10)     NOT NULL,
    dom_tipo_vivienda       VARCHAR(50),
    dom_monto_renta         DECIMAL(12,2),

    -- Negocio
    negocio_nombre          VARCHAR(150)    NOT NULL,
    negocio_giro            VARCHAR(100)    NOT NULL,
    negocio_antiguedad      VARCHAR(50)     NOT NULL,
    negocio_direccion       VARCHAR(255),
    negocio_tipo_local      VARCHAR(50),
    negocio_monto_renta     DECIMAL(12,2),
    negocio_horarios        VARCHAR(150),

    -- Finanzas del cliente
    ingresos_semanales      DECIMAL(12,2),
    gastos_semanales        DECIMAL(12,2),
    gastos_renta            DECIMAL(12,2),
    gastos_otros            DECIMAL(12,2),

    -- Referencias personales
    ref1_nombre             VARCHAR(150)    NOT NULL,
    ref1_telefono           VARCHAR(20)     NOT NULL,
    ref1_parentesco         VARCHAR(50)     NOT NULL,
    ref2_nombre             VARCHAR(150)    NOT NULL,
    ref2_telefono           VARCHAR(20)     NOT NULL,
    ref2_parentesco         VARCHAR(50)     NOT NULL,

    -- Aval (opcional)
    aval_nombre             VARCHAR(150),
    aval_telefono           VARCHAR(20),
    aval_direccion          VARCHAR(255),
    aval_identificacion     VARCHAR(50),

    asesor_id               BIGINT          REFERENCES usuarios(id),
    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),
    activo                  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by              BIGINT          REFERENCES usuarios(id)
);

-- ------------------------------------------------------------------
-- CRÉDITOS
-- ------------------------------------------------------------------
CREATE TABLE creditos (
    id                      BIGSERIAL       PRIMARY KEY,
    cliente_id              BIGINT          NOT NULL REFERENCES clientes(id),
    asesor_id               BIGINT          NOT NULL REFERENCES usuarios(id),
    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),

    -- Producto
    monto_capital           DECIMAL(12,2)   NOT NULL,
    tasa_interes            DECIMAL(5,4)    NOT NULL,   -- 0.30 = 30%
    cargo_financiero        DECIMAL(12,2)   NOT NULL,
    total_a_pagar           DECIMAL(12,2)   NOT NULL,
    pago_periodico          DECIMAL(12,2)   NOT NULL,   -- pago_diario o semanal
    plazo_dias              INTEGER         NOT NULL,   -- 25 o 30
    tipo_pago               VARCHAR(10)     NOT NULL CHECK (tipo_pago IN ('DIARIO','SEMANAL')),

    -- Fechas
    fecha_inicio            DATE            NOT NULL,
    fecha_vencimiento       DATE            NOT NULL,

    -- Último pago cobrado por adelantado al momento del desembolso
    pago_adelantado         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

    -- Garantía y evidencia
    garantia_descripcion    TEXT,
    evidencia_urls          TEXT[],                     -- Array de URLs S3

    -- Estado
    estado                  VARCHAR(20)     NOT NULL DEFAULT 'ACTIVO'
                                CHECK (estado IN ('ACTIVO','PAGADO','RENOVADO','CANCELADO')),

    -- Lugar de colocación
    lugar                   VARCHAR(100),

    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by              BIGINT          REFERENCES usuarios(id)
);

-- ------------------------------------------------------------------
-- CALENDARIO DE PAGOS
-- ------------------------------------------------------------------
CREATE TABLE calendario_pagos (
    id                  BIGSERIAL       PRIMARY KEY,
    credito_id          BIGINT          NOT NULL REFERENCES creditos(id),
    numero_pago         INTEGER         NOT NULL,
    fecha_programada    DATE            NOT NULL,
    monto_esperado      DECIMAL(12,2)   NOT NULL,
    estado              VARCHAR(20)     NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado IN ('PENDIENTE','PAGADO','NO_PAGADO','PARCIAL','ADELANTADO')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (credito_id, numero_pago)
);

-- ------------------------------------------------------------------
-- PAGOS
-- ------------------------------------------------------------------
CREATE TABLE pagos (
    id                  BIGSERIAL       PRIMARY KEY,
    credito_id          BIGINT          NOT NULL REFERENCES creditos(id),
    cliente_id          BIGINT          NOT NULL REFERENCES clientes(id),
    asesor_id           BIGINT          NOT NULL REFERENCES usuarios(id),
    calendario_pago_id  BIGINT          REFERENCES calendario_pagos(id),
    numero_pago         INTEGER         NOT NULL,
    fecha_pago          DATE            NOT NULL,
    monto_recibido      DECIMAL(12,2)   NOT NULL,
    monto_esperado      DECIMAL(12,2)   NOT NULL,
    es_completo         BOOLEAN         NOT NULL DEFAULT TRUE,
    razon_no_pago       TEXT,
    multa_aplicada      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    modalidad           VARCHAR(10)     NOT NULL CHECK (modalidad IN ('CAJA','RUTA')),
    registrado_por      BIGINT          NOT NULL REFERENCES usuarios(id),
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- MULTAS
-- ------------------------------------------------------------------
CREATE TABLE multas (
    id                  BIGSERIAL       PRIMARY KEY,
    pago_id             BIGINT          REFERENCES pagos(id),
    cliente_id          BIGINT          NOT NULL REFERENCES clientes(id),
    credito_id          BIGINT          NOT NULL REFERENCES creditos(id),
    tipo                VARCHAR(20)     NOT NULL CHECK (tipo IN ('NO_PAGO','INCOMPLETO')),
    monto               DECIMAL(12,2)   NOT NULL,
    fecha               DATE            NOT NULL,
    cobrada             BOOLEAN         NOT NULL DEFAULT FALSE,
    cobrada_en_pago_id  BIGINT          REFERENCES pagos(id),
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- RENOVACIONES
-- ------------------------------------------------------------------
CREATE TABLE renovaciones (
    id                          BIGSERIAL       PRIMARY KEY,
    credito_anterior_id         BIGINT          NOT NULL REFERENCES creditos(id),
    credito_nuevo_id            BIGINT          NOT NULL REFERENCES creditos(id),
    cliente_id                  BIGINT          NOT NULL REFERENCES clientes(id),
    asesor_id                   BIGINT          NOT NULL REFERENCES usuarios(id),
    fecha                       DATE            NOT NULL,
    pagos_restantes             INTEGER         NOT NULL,
    monto_pagos_restantes       DECIMAL(12,2)   NOT NULL,
    multas_pendientes           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    pago_adelantado             DECIMAL(12,2)   NOT NULL,
    monto_desembolso            DECIMAL(12,2)   NOT NULL,
    salida_de                   VARCHAR(10)     NOT NULL CHECK (salida_de IN ('CAJA','RUTA')),
    garantia_descripcion        TEXT,
    deleted_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by                  BIGINT          REFERENCES usuarios(id)
);

-- ------------------------------------------------------------------
-- COLOCACIONES
-- ------------------------------------------------------------------
CREATE TABLE colocaciones (
    id              BIGSERIAL       PRIMARY KEY,
    semana_inicio   DATE            NOT NULL,
    semana_fin      DATE            NOT NULL,
    credito_id      BIGINT          NOT NULL REFERENCES creditos(id),
    tipo            VARCHAR(20)     NOT NULL CHECK (tipo IN ('NUEVO','RENOVACION')),
    monto           DECIMAL(12,2)   NOT NULL,
    desembolso      DECIMAL(12,2)   NOT NULL,
    asesor_id       BIGINT          NOT NULL REFERENCES usuarios(id),
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    dia_semana      VARCHAR(20)     NOT NULL,   -- LUNES, MARTES, ...
    fecha           DATE            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- APERTURAS DE CAJA
-- ------------------------------------------------------------------
CREATE TABLE aperturas_caja (
    id                  BIGSERIAL       PRIMARY KEY,
    fecha               DATE            NOT NULL,
    usuario_id          BIGINT          NOT NULL REFERENCES usuarios(id),
    sucursal_id         BIGINT          NOT NULL REFERENCES sucursales(id),
    monto_apertura      DECIMAL(12,2)   NOT NULL,
    concepto_inversion  VARCHAR(255),
    monto_inversion     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    observaciones       TEXT,
    abierta             BOOLEAN         NOT NULL DEFAULT TRUE,
    cerrada_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (fecha, sucursal_id)
);

-- ------------------------------------------------------------------
-- CORTES DE CAJA
-- ------------------------------------------------------------------
CREATE TABLE cortes_caja (
    id                      BIGSERIAL       PRIMARY KEY,
    apertura_id             BIGINT          NOT NULL REFERENCES aperturas_caja(id),
    fecha                   DATE            NOT NULL,
    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),

    -- Componentes del corte
    inversion               DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    ingreso_carteras        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    desembolsos             DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    subtotal                DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    apartado_24pct          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_libres            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    gastos_total            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    creditos_nuevos         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    ahorro                  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_real_libres       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

    cerrado_por             BIGINT          NOT NULL REFERENCES usuarios(id),
    pdf_url                 VARCHAR(500),               -- URL S3 del PDF del corte
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- GASTOS OPERATIVOS
-- ------------------------------------------------------------------
CREATE TABLE gastos (
    id                      BIGSERIAL       PRIMARY KEY,
    fecha                   DATE            NOT NULL,
    categoria               VARCHAR(30)     NOT NULL
                                CHECK (categoria IN ('GASOLINA','MOTOS','RECARGAS','SOLICITUD_DUENO','VARIOS')),
    descripcion             TEXT,
    monto                   DECIMAL(12,2)   NOT NULL,
    responsable_id          BIGINT          NOT NULL REFERENCES usuarios(id),
    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),
    comprobante_referencia  VARCHAR(500),               -- Texto libre: folio, ticket, descripción (NO archivo)
    corte_id                BIGINT          REFERENCES cortes_caja(id),
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by              BIGINT          REFERENCES usuarios(id)
);

-- ------------------------------------------------------------------
-- CONFIGURACIÓN DE MULTAS
-- ------------------------------------------------------------------
CREATE TABLE config_multas (
    id                      BIGSERIAL       PRIMARY KEY,
    sucursal_id             BIGINT          NOT NULL REFERENCES sucursales(id),
    rango_min               DECIMAL(12,2)   NOT NULL,
    rango_max               DECIMAL(12,2)   NOT NULL,
    multa_no_pago           DECIMAL(12,2)   NOT NULL DEFAULT 50.00,     -- Por día no pagado
    multa_incompletos       DECIMAL(12,2)   NOT NULL DEFAULT 50.00,     -- Por cada 2 pagos incompletos
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_rango_valido CHECK (rango_max > rango_min)
);

-- ------------------------------------------------------------------
-- DÍAS FESTIVOS
-- ------------------------------------------------------------------
CREATE TABLE dias_festivos (
    id                  BIGSERIAL       PRIMARY KEY,
    fecha               DATE            NOT NULL,
    descripcion         VARCHAR(150)    NOT NULL,
    aplica_sucursal_id  BIGINT          REFERENCES sucursales(id),   -- NULL = todas las sucursales
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          BIGINT          REFERENCES usuarios(id),

    UNIQUE (fecha, aplica_sucursal_id)
);

-- ------------------------------------------------------------------
-- BITÁCORA
-- ------------------------------------------------------------------
CREATE TABLE bitacora (
    id          BIGSERIAL       PRIMARY KEY,
    usuario_id  BIGINT          REFERENCES usuarios(id),
    accion      VARCHAR(20)     NOT NULL
                    CHECK (accion IN ('LOGIN','LOGOUT','CREAR','MODIFICAR','ELIMINAR','APROBAR','CERRAR','CONSULTAR')),
    modulo      VARCHAR(50)     NOT NULL,
    detalle     TEXT,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO
-- ------------------------------------------------------------------

-- Clientes
CREATE INDEX idx_clientes_sucursal       ON clientes(sucursal_id);
CREATE INDEX idx_clientes_asesor         ON clientes(asesor_id);
CREATE INDEX idx_clientes_activo         ON clientes(activo) WHERE activo = TRUE;
CREATE INDEX idx_clientes_nombre         ON clientes(apellido_paterno, apellido_materno, nombre);

-- Créditos
CREATE INDEX idx_creditos_cliente        ON creditos(cliente_id);
CREATE INDEX idx_creditos_asesor         ON creditos(asesor_id);
CREATE INDEX idx_creditos_sucursal       ON creditos(sucursal_id);
CREATE INDEX idx_creditos_estado         ON creditos(estado);
CREATE INDEX idx_creditos_fecha_inicio   ON creditos(fecha_inicio);

-- Calendario de pagos
CREATE INDEX idx_calendario_credito      ON calendario_pagos(credito_id);
CREATE INDEX idx_calendario_fecha        ON calendario_pagos(fecha_programada);
CREATE INDEX idx_calendario_estado       ON calendario_pagos(estado);

-- Pagos
CREATE INDEX idx_pagos_credito           ON pagos(credito_id);
CREATE INDEX idx_pagos_cliente           ON pagos(cliente_id);
CREATE INDEX idx_pagos_fecha             ON pagos(fecha_pago);
CREATE INDEX idx_pagos_asesor            ON pagos(asesor_id);

-- Multas
CREATE INDEX idx_multas_cliente          ON multas(cliente_id);
CREATE INDEX idx_multas_credito          ON multas(credito_id);
CREATE INDEX idx_multas_cobrada          ON multas(cobrada) WHERE cobrada = FALSE;

-- Caja
CREATE INDEX idx_aperturas_fecha         ON aperturas_caja(fecha, sucursal_id);
CREATE INDEX idx_cortes_fecha            ON cortes_caja(fecha, sucursal_id);

-- Gastos
CREATE INDEX idx_gastos_fecha            ON gastos(fecha, sucursal_id);
CREATE INDEX idx_gastos_corte            ON gastos(corte_id);

-- Colocaciones
CREATE INDEX idx_colocaciones_semana     ON colocaciones(semana_inicio, sucursal_id);

-- Bitácora
CREATE INDEX idx_bitacora_usuario        ON bitacora(usuario_id);
CREATE INDEX idx_bitacora_fecha          ON bitacora(created_at DESC);
CREATE INDEX idx_bitacora_modulo         ON bitacora(modulo);

-- ------------------------------------------------------------------
-- DATOS INICIALES
-- ------------------------------------------------------------------

-- Sucursal principal
INSERT INTO sucursales (nombre, multa_base, ahorro_diario)
VALUES ('Sucursal Principal', 50.00, 2000.00);

-- Usuario administrador por defecto
-- Contraseña: Admin@2024 (BCrypt hash generado con strength 12)
INSERT INTO usuarios (
    nombre_completo, email, password_hash, telefono,
    rol_id, sucursal_id,
    calle, no_exterior, colonia, municipio, estado, codigo_postal,
    ine_numero,
    ref1_nombre, ref1_telefono, ref1_parentesco,
    ref2_nombre, ref2_telefono, ref2_parentesco
) VALUES (
    'Administrador Sistema',
    'admin@magno.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdCBCiMbWdzWC3G',
    '0000000000',
    (SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR'),
    1,
    'Calle Principal', '1', 'Centro', 'Ciudad', 'Estado', '00000',
    '0000000000000000000',
    'Referencia Uno', '0000000000', 'Conocido',
    'Referencia Dos', '0000000000', 'Conocido'
);

-- Configuración de multas por defecto (Sucursal Principal)
INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
VALUES
    (1, 1000.00,  14000.00, 50.00,  50.00),
    (1, 15000.00, 50000.00, 100.00, 100.00);
