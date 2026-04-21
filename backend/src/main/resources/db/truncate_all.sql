-- Script para limpiar TODA la base de datos
-- Truncate de todas las tablas en orden inverso de dependencias

BEGIN;

-- Desactivar verificación de ForeignKeys temporalmente
ALTER TABLE usuarios DISABLE TRIGGER ALL;
ALTER TABLE sucursales DISABLE TRIGGER ALL;
ALTER TABLE clientes DISABLE TRIGGER ALL;
ALTER TABLE creditos DISABLE TRIGGER ALL;
ALTER TABLE calendario_pagos DISABLE TRIGGER ALL;
ALTER TABLE pagos DISABLE TRIGGER ALL;
ALTER TABLE multas DISABLE TRIGGER ALL;
ALTER TABLE renovaciones DISABLE TRIGGER ALL;
ALTER TABLE colocaciones DISABLE TRIGGER ALL;
ALTER TABLE aperturas_caja DISABLE TRIGGER ALL;
ALTER TABLE cortes_caja DISABLE TRIGGER ALL;
ALTER TABLE gastos DISABLE TRIGGER ALL;
ALTER TABLE cliente_documentos DISABLE TRIGGER ALL;
ALTER TABLE dias_festivos DISABLE TRIGGER ALL;
ALTER TABLE config_multas DISABLE TRIGGER ALL;
ALTER TABLE bitacora DISABLE TRIGGER ALL;

-- Truncate en orden correcto (sin dependencias circulares)
TRUNCATE TABLE bitacora CASCADE;
TRUNCATE TABLE dias_festivos CASCADE;
TRUNCATE TABLE config_multas CASCADE;
TRUNCATE TABLE gastos CASCADE;
TRUNCATE TABLE cortes_caja CASCADE;
TRUNCATE TABLE aperturas_caja CASCADE;
TRUNCATE TABLE colocaciones CASCADE;
TRUNCATE TABLE cliente_documentos CASCADE;
TRUNCATE TABLE renovaciones CASCADE;
TRUNCATE TABLE multas CASCADE;
TRUNCATE TABLE pagos CASCADE;
TRUNCATE TABLE calendario_pagos CASCADE;
TRUNCATE TABLE creditos CASCADE;
TRUNCATE TABLE clientes CASCADE;
TRUNCATE TABLE usuarios CASCADE;
TRUNCATE TABLE sucursales CASCADE;

-- Re-habilitar triggers
ALTER TABLE usuarios ENABLE TRIGGER ALL;
ALTER TABLE sucursales ENABLE TRIGGER ALL;
ALTER TABLE clientes ENABLE TRIGGER ALL;
ALTER TABLE creditos ENABLE TRIGGER ALL;
ALTER TABLE calendario_pagos ENABLE TRIGGER ALL;
ALTER TABLE pagos ENABLE TRIGGER ALL;
ALTER TABLE multas ENABLE TRIGGER ALL;
ALTER TABLE renovaciones ENABLE TRIGGER ALL;
ALTER TABLE colocaciones ENABLE TRIGGER ALL;
ALTER TABLE aperturas_caja ENABLE TRIGGER ALL;
ALTER TABLE cortes_caja ENABLE TRIGGER ALL;
ALTER TABLE gastos ENABLE TRIGGER ALL;
ALTER TABLE cliente_documentos ENABLE TRIGGER ALL;
ALTER TABLE dias_festivos ENABLE TRIGGER ALL;
ALTER TABLE config_multas ENABLE TRIGGER ALL;
ALTER TABLE bitacora ENABLE TRIGGER ALL;

-- Reinsertar sucursal y usuario principal por defecto
INSERT INTO sucursales (nombre, multa_base, ahorro_diario)
VALUES ('Sucursal Principal', 50.00, 2000.00);

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

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
VALUES
    (1, 1000.00,  14000.00, 50.00,  50.00),
    (1, 15000.00, 50000.00, 100.00, 100.00);

COMMIT;

SELECT 'Base de datos limpiada exitosamente ✓' AS status;
