-- =============================================================
-- MAGNO — V17: Seeds de Caja
--
-- Inserta:
--   1. config_sucursal para la sucursal principal (si no existe)
--   2. conceptos_inversion variados
--   3. 10 cajas cerradas (2 semanas de historial: 2026-04-06 al 2026-04-17)
--   4. 3+ movimientos de inversión por semana
--   5. Una caja ABIERTA para hoy (2026-04-24) — solo si no existe
-- =============================================================

-- ------------------------------------------------------------------
-- 1. CONFIGURACIÓN DE SUCURSAL PRINCIPAL
-- ------------------------------------------------------------------
INSERT INTO config_sucursal (
    sucursal_id,
    hora_limite_operacion,
    porcentaje_ahorro,
    monto_ahorro_fijo,
    dia_pago_nomina,
    updated_by
)
SELECT 1, '17:00:00', 0.2400, 1500.00, 'JUEVES', 1
WHERE NOT EXISTS (SELECT 1 FROM config_sucursal WHERE sucursal_id = 1);

-- ------------------------------------------------------------------
-- 2. CONCEPTOS DE INVERSIÓN
-- ------------------------------------------------------------------
INSERT INTO conceptos_inversion (sucursal_id, nombre, created_by, updated_by)
SELECT 1, 'Inyección de capital', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Inyección de capital');

INSERT INTO conceptos_inversion (sucursal_id, nombre, created_by, updated_by)
SELECT 1, 'Retiro del dueño', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Retiro del dueño');

INSERT INTO conceptos_inversion (sucursal_id, nombre, created_by, updated_by)
SELECT 1, 'Pago de préstamo bancario', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Pago de préstamo bancario');

INSERT INTO conceptos_inversion (sucursal_id, nombre, created_by, updated_by)
SELECT 1, 'Transferencia entre cajas', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Transferencia entre cajas');

INSERT INTO conceptos_inversion (sucursal_id, nombre, created_by, updated_by)
SELECT 1, 'Depósito banco', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Depósito banco');

-- ------------------------------------------------------------------
-- 3. CAJAS CERRADAS — SEMANA 1 (2026-04-06 al 2026-04-10)
-- ------------------------------------------------------------------

-- Lunes 2026-04-06
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-06', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-06 08:15:00+00',
    1, '2026-04-06 17:05:00+00',
    34200.00, 15000.00, 23700.00,
    8208.00, 1500.00, 6708.00
);

-- Martes 2026-04-07
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-07', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-07 08:10:00+00',
    1, '2026-04-07 17:08:00+00',
    36500.00, 18000.00, 22500.00,
    8760.00, 1500.00, 7260.00
);

-- Miércoles 2026-04-08
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-08', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-08 08:20:00+00',
    1, '2026-04-08 17:12:00+00',
    31800.00, 12000.00, 24300.00,
    7632.00, 1500.00, 6132.00
);

-- Jueves 2026-04-09
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-09', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-09 08:05:00+00',
    1, '2026-04-09 17:02:00+00',
    38100.00, 22000.00, 20600.00,
    9144.00, 1500.00, 7644.00
);

-- Viernes 2026-04-10
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-10', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-10 08:12:00+00',
    1, '2026-04-10 17:00:00+00',
    40200.00, 25000.00, 19700.00,
    9648.00, 1500.00, 8148.00
);

-- ------------------------------------------------------------------
-- 4. MOVIMIENTOS DE INVERSIÓN — SEMANA 1
-- ------------------------------------------------------------------

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Inyección de capital'),
    'Capital adicional semana 1',
    5000.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-06';

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Retiro del dueño'),
    'Retiro quincenal',
    -3000.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-09';

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Pago de préstamo bancario'),
    'Abono mensual HSBC',
    -2500.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-10';

-- ------------------------------------------------------------------
-- 5. CAJAS CERRADAS — SEMANA 2 (2026-04-13 al 2026-04-17)
-- ------------------------------------------------------------------

-- Lunes 2026-04-13
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-13', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-13 08:08:00+00',
    1, '2026-04-13 17:03:00+00',
    35400.00, 14000.00, 25900.00,
    8496.00, 1500.00, 6996.00
);

-- Martes 2026-04-14
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-14', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-14 08:15:00+00',
    1, '2026-04-14 17:10:00+00',
    33700.00, 16500.00, 21700.00,
    8088.00, 1500.00, 6588.00
);

-- Miércoles 2026-04-15
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-15', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-15 08:20:00+00',
    1, '2026-04-15 17:05:00+00',
    37200.00, 19000.00, 22700.00,
    8928.00, 1500.00, 7428.00
);

-- Jueves 2026-04-16
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-16', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-16 08:05:00+00',
    1, '2026-04-16 17:00:00+00',
    39600.00, 21000.00, 22600.00,
    9504.00, 1500.00, 8004.00
);

-- Viernes 2026-04-17
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura,
    cerrada_por, fecha_hora_cierre,
    ingreso_carteras, desembolsos, subtotal_caja,
    monto_libres, ahorro_fijo, total_real_libres
) VALUES (
    1, '2026-04-17', 'CERRADA',
    2000.00, 'Fondo de apertura',
    1, '2026-04-17 08:10:00+00',
    1, '2026-04-17 17:15:00+00',
    41500.00, 27000.00, 19000.00,
    9960.00, 1500.00, 8460.00
);

-- ------------------------------------------------------------------
-- 6. MOVIMIENTOS DE INVERSIÓN — SEMANA 2
-- ------------------------------------------------------------------

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Depósito banco'),
    'Depósito semanal',
    8000.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-13';

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Retiro del dueño'),
    'Retiro quincenal',
    -3000.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-16';

INSERT INTO caja_movimiento_inversion (
    caja_dia_id, concepto_inversion_id, descripcion, monto, registrado_por
)
SELECT
    cd.id,
    (SELECT id FROM conceptos_inversion WHERE sucursal_id = 1 AND nombre = 'Transferencia entre cajas'),
    'Envío a sucursal norte',
    -1500.00,
    1
FROM caja_dia cd WHERE cd.sucursal_id = 1 AND cd.fecha = '2026-04-17';

-- ------------------------------------------------------------------
-- 7. CAJA ABIERTA PARA HOY (2026-04-24) — solo si no existe
-- ------------------------------------------------------------------
INSERT INTO caja_dia (
    sucursal_id, fecha, estado,
    monto_apertura, concepto_apertura,
    abierta_por, fecha_hora_apertura
)
SELECT 1, '2026-04-24', 'ABIERTA',
       2000.00, 'Fondo de apertura dev',
       1, NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-24'
);
