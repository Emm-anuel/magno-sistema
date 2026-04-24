-- ============================================================
-- MAGNO — Seed: Módulo de Administración (dev)
-- Requiere que seed_dev_01_base.sql ya haya corrido
-- (la tabla temporal magno_seed_ids debe existir en sesión).
-- ============================================================

DO $$
DECLARE
  v_suc_centro  BIGINT;
  v_suc_norte   BIGINT;
  v_suc_sur     BIGINT;
  v_admin       BIGINT;
  v_gte_cen     BIGINT;
  v_gte_nor     BIGINT;
  v_gte_sur     BIGINT;
BEGIN

-- ────────────────────────────────────────────────────────────────
-- Leer IDs directamente (no depende de sesión anterior)
-- ────────────────────────────────────────────────────────────────
SELECT id INTO v_suc_centro FROM sucursales WHERE nombre = 'Centro';
SELECT id INTO v_suc_norte  FROM sucursales WHERE nombre = 'Norte';
SELECT id INTO v_suc_sur    FROM sucursales WHERE nombre = 'Sur';

SELECT id INTO v_admin    FROM usuarios WHERE email = 'admin@magno.mx';
SELECT id INTO v_gte_cen  FROM usuarios WHERE email = 'gerente.centro@magno.mx';
SELECT id INTO v_gte_nor  FROM usuarios WHERE email = 'gerente.norte@magno.mx';
SELECT id INTO v_gte_sur  FROM usuarios WHERE email = 'gerente.sur@magno.mx';

-- ────────────────────────────────────────────────────────────────
-- 1. CONFIG_SUCURSAL — una fila por sucursal
-- ────────────────────────────────────────────────────────────────
INSERT INTO config_sucursal (sucursal_id, hora_limite_operacion, porcentaje_ahorro, monto_ahorro_fijo, dia_pago_nomina, updated_by)
SELECT v_suc_centro, '17:00:00', 0.2400, 0.00, 'JUEVES', v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_sucursal WHERE sucursal_id = v_suc_centro);

INSERT INTO config_sucursal (sucursal_id, hora_limite_operacion, porcentaje_ahorro, monto_ahorro_fijo, dia_pago_nomina, updated_by)
SELECT v_suc_norte, '17:00:00', 0.2400, 0.00, 'JUEVES', v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_sucursal WHERE sucursal_id = v_suc_norte);

INSERT INTO config_sucursal (sucursal_id, hora_limite_operacion, porcentaje_ahorro, monto_ahorro_fijo, dia_pago_nomina, updated_by)
SELECT v_suc_sur, '17:00:00', 0.2400, 0.00, 'JUEVES', v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_sucursal WHERE sucursal_id = v_suc_sur);

-- ────────────────────────────────────────────────────────────────
-- 2. CONFIG_RANGOS_CREDITO — por sucursal
--    DIARIO:  [$1k–$14,999]/25d/30%  [$15k–$19,999]/25d/24%  [$20k–$50k]/30d/24%
--    SEMANAL: [$2k–$9,999]/8sem/40%  [$10k–$30k]/12sem/40%
-- ────────────────────────────────────────────────────────────────
INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_centro, 'DIARIO', 1000.00,  14999.99, 25, 0.3000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_centro AND tipo_pago = 'DIARIO' AND rango_min = 1000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_centro, 'DIARIO', 15000.00, 19999.99, 25, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_centro AND tipo_pago = 'DIARIO' AND rango_min = 15000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_centro, 'DIARIO', 20000.00, 50000.00, 30, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_centro AND tipo_pago = 'DIARIO' AND rango_min = 20000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_centro, 'SEMANAL', 2000.00,  9999.99, 8,  0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_centro AND tipo_pago = 'SEMANAL' AND rango_min = 2000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_centro, 'SEMANAL', 10000.00, 30000.00, 12, 0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_centro AND tipo_pago = 'SEMANAL' AND rango_min = 10000.00);

-- Norte
INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_norte, 'DIARIO', 1000.00,  14999.99, 25, 0.3000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_norte AND tipo_pago = 'DIARIO' AND rango_min = 1000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_norte, 'DIARIO', 15000.00, 19999.99, 25, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_norte AND tipo_pago = 'DIARIO' AND rango_min = 15000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_norte, 'DIARIO', 20000.00, 50000.00, 30, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_norte AND tipo_pago = 'DIARIO' AND rango_min = 20000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_norte, 'SEMANAL', 2000.00,  9999.99, 8,  0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_norte AND tipo_pago = 'SEMANAL' AND rango_min = 2000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_norte, 'SEMANAL', 10000.00, 30000.00, 12, 0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_norte AND tipo_pago = 'SEMANAL' AND rango_min = 10000.00);

-- Sur
INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_sur, 'DIARIO', 1000.00,  14999.99, 25, 0.3000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_sur AND tipo_pago = 'DIARIO' AND rango_min = 1000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_sur, 'DIARIO', 15000.00, 19999.99, 25, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_sur AND tipo_pago = 'DIARIO' AND rango_min = 15000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_sur, 'DIARIO', 20000.00, 50000.00, 30, 0.2400, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_sur AND tipo_pago = 'DIARIO' AND rango_min = 20000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_sur, 'SEMANAL', 2000.00,  9999.99, 8,  0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_sur AND tipo_pago = 'SEMANAL' AND rango_min = 2000.00);

INSERT INTO config_rangos_credito (sucursal_id, tipo_pago, rango_min, rango_max, plazo, tasa_interes, updated_by)
SELECT v_suc_sur, 'SEMANAL', 10000.00, 30000.00, 12, 0.4000, v_admin
WHERE NOT EXISTS (SELECT 1 FROM config_rangos_credito WHERE sucursal_id = v_suc_sur AND tipo_pago = 'SEMANAL' AND rango_min = 10000.00);

-- ────────────────────────────────────────────────────────────────
-- 3. CONFIG_UMBRALES_RENOVACION — 4 combos por sucursal
-- ────────────────────────────────────────────────────────────────
-- Centro
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_centro, 'DIARIO',  25, 16, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_centro AND tipo_pago = 'DIARIO'  AND plazo = 25);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_centro, 'DIARIO',  30, 19, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_centro AND tipo_pago = 'DIARIO'  AND plazo = 30);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_centro, 'SEMANAL',  8,  5, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_centro AND tipo_pago = 'SEMANAL' AND plazo =  8);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_centro, 'SEMANAL', 12,  9, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_centro AND tipo_pago = 'SEMANAL' AND plazo = 12);

-- Norte
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_norte, 'DIARIO',  25, 16, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_norte AND tipo_pago = 'DIARIO'  AND plazo = 25);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_norte, 'DIARIO',  30, 19, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_norte AND tipo_pago = 'DIARIO'  AND plazo = 30);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_norte, 'SEMANAL',  8,  5, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_norte AND tipo_pago = 'SEMANAL' AND plazo =  8);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_norte, 'SEMANAL', 12,  9, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_norte AND tipo_pago = 'SEMANAL' AND plazo = 12);

-- Sur
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_sur, 'DIARIO',  25, 16, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_sur AND tipo_pago = 'DIARIO'  AND plazo = 25);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_sur, 'DIARIO',  30, 19, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_sur AND tipo_pago = 'DIARIO'  AND plazo = 30);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_sur, 'SEMANAL',  8,  5, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_sur AND tipo_pago = 'SEMANAL' AND plazo =  8);
INSERT INTO config_umbrales_renovacion (sucursal_id, tipo_pago, plazo, umbral_pagos, updated_by)
SELECT v_suc_sur, 'SEMANAL', 12,  9, v_admin WHERE NOT EXISTS (SELECT 1 FROM config_umbrales_renovacion WHERE sucursal_id = v_suc_sur AND tipo_pago = 'SEMANAL' AND plazo = 12);

-- ────────────────────────────────────────────────────────────────
-- 4. NOMINA_PERSONAL — ≥3 por sucursal
-- ────────────────────────────────────────────────────────────────
-- Centro (3 registros)
INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_centro, 'Carlos Mendoza López',  'Asesor Cobrador',   1800.00, v_gte_cen
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_centro AND nombre = 'Carlos Mendoza López' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_centro, 'Laura Sánchez Ruiz',    'Asesor Cobrador',   1800.00, v_gte_cen
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_centro AND nombre = 'Laura Sánchez Ruiz' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_centro, 'Javier Cruz Torres',    'Servicio Limpieza', 1200.00, v_gte_cen
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_centro AND nombre = 'Javier Cruz Torres' AND deleted_at IS NULL);

-- Norte (3 registros)
INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_norte, 'Fernando Ortega Cruz',   'Asesor Cobrador',   1800.00, v_gte_nor
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_norte AND nombre = 'Fernando Ortega Cruz' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_norte, 'Adriana Luna Pérez',     'Asesor Cobrador',   1800.00, v_gte_nor
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_norte AND nombre = 'Adriana Luna Pérez' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_norte, 'Rosa Medina Solano',     'Servicio Limpieza', 1200.00, v_gte_nor
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_norte AND nombre = 'Rosa Medina Solano' AND deleted_at IS NULL);

-- Sur (3 registros)
INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_sur, 'Sofía Ramírez Peña',     'Asesor Cobrador',   1800.00, v_gte_sur
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_sur AND nombre = 'Sofía Ramírez Peña' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_sur, 'Jorge Salinas Mora',      'Asesor Cobrador',   1800.00, v_gte_sur
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_sur AND nombre = 'Jorge Salinas Mora' AND deleted_at IS NULL);

INSERT INTO nomina_personal (sucursal_id, nombre, puesto, monto_semanal, created_by)
SELECT v_suc_sur, 'Beatriz Olvera Fuentes',  'Servicio Limpieza', 1200.00, v_gte_sur
WHERE NOT EXISTS (SELECT 1 FROM nomina_personal WHERE sucursal_id = v_suc_sur AND nombre = 'Beatriz Olvera Fuentes' AND deleted_at IS NULL);

-- ────────────────────────────────────────────────────────────────
-- 5. DIAS_FESTIVOS — feriados nacionales mexicanos (aplica_sucursal_id = NULL)
-- ────────────────────────────────────────────────────────────────
INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-01-01', 'Año Nuevo', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-01-01' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-02-03', 'Día de la Constitución (lunes por ley)', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-02-03' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-03-17', 'Natalicio de Benito Juárez (lunes por ley)', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-03-17' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-05-01', 'Día del Trabajo', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-05-01' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-09-16', 'Día de la Independencia', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-09-16' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-11-17', 'Revolución Mexicana (lunes por ley)', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-11-17' AND aplica_sucursal_id IS NULL);

INSERT INTO dias_festivos (fecha, descripcion, aplica_sucursal_id)
SELECT '2025-12-25', 'Navidad', NULL
WHERE NOT EXISTS (SELECT 1 FROM dias_festivos WHERE fecha = '2025-12-25' AND aplica_sucursal_id IS NULL);

-- ────────────────────────────────────────────────────────────────
-- 6. BITACORA_CONFIG — registros de ejemplo (≥10)
-- ────────────────────────────────────────────────────────────────
INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_centro, 'CONFIG_GENERAL', 'hora_limite_operacion', '18:00:00', '17:00:00', NOW() - INTERVAL '30 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_admin AND sucursal_id = v_suc_centro AND campo = 'hora_limite_operacion' AND valor_nuevo = '17:00:00');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_centro, 'AHORRO', 'porcentaje_ahorro', '0.2000', '0.2400', NOW() - INTERVAL '28 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_admin AND sucursal_id = v_suc_centro AND campo = 'porcentaje_ahorro' AND valor_nuevo = '0.2400');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_norte, 'MULTAS', 'multa_no_pago', '100.00', '50.00', NOW() - INTERVAL '25 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_admin AND sucursal_id = v_suc_norte AND campo = 'multa_no_pago');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_norte, 'MULTAS', 'multa_incompletos', '50.00', '50.00', NOW() - INTERVAL '25 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_admin AND sucursal_id = v_suc_norte AND campo = 'multa_incompletos');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_centro, 'RANGOS_CREDITO', 'tasa_interes [DIARIO/1000-14999]', '0.3500', '0.3000', NOW() - INTERVAL '20 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id = v_suc_centro AND campo = 'tasa_interes [DIARIO/1000-14999]');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_sur, 'CONFIG_GENERAL', 'dia_pago_nomina', 'VIERNES', 'JUEVES', NOW() - INTERVAL '18 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id = v_suc_sur AND campo = 'dia_pago_nomina');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_gte_cen, v_suc_centro, 'NOMINA', 'nombre', 'Luis Hernández', 'Carlos Mendoza López', NOW() - INTERVAL '15 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_gte_cen AND campo = 'nombre');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, NULL, 'DIAS_INHABILES', 'fecha', NULL, '2025-05-01', NOW() - INTERVAL '12 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id IS NULL AND campo = 'fecha' AND valor_nuevo = '2025-05-01');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_norte, 'UMBRALES_RENOVACION', 'umbral_pagos [DIARIO/25]', '14', '16', NOW() - INTERVAL '10 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id = v_suc_norte AND campo = 'umbral_pagos [DIARIO/25]');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_gte_nor, v_suc_norte, 'CONCEPTOS', 'nombre', NULL, 'Reinversión socio', NOW() - INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE usuario_id = v_gte_nor AND campo = 'nombre');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_sur, 'AHORRO', 'monto_ahorro_fijo', '0.00', '500.00', NOW() - INTERVAL '3 days'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id = v_suc_sur AND campo = 'monto_ahorro_fijo');

INSERT INTO bitacora_config (usuario_id, sucursal_id, seccion, campo, valor_anterior, valor_nuevo, created_at)
SELECT v_admin, v_suc_centro, 'CONFIG_GENERAL', 'hora_limite_operacion', '17:00:00', '17:30:00', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM bitacora_config WHERE sucursal_id = v_suc_centro AND campo = 'hora_limite_operacion' AND valor_nuevo = '17:30:00');

END $$;
