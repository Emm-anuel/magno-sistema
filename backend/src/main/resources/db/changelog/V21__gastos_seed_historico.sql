-- =============================================================
-- MAGNO — V21: Seeds de Gastos Históricos
--
-- Inserta gastos realistas para las 10 cajas cerradas semanales
-- de la sucursal principal (sucursal_id = 1):
--   Semana 1: 2026-04-06 al 2026-04-10
--   Semana 2: 2026-04-13 al 2026-04-17
--
-- Mínimo 5 gastos por día (≥ 50 gastos en total).
-- Categorías: Gasolina · Servicio de Motos · Gastos Varios
-- Registrado por: usuario id=1 (administrador)
--
-- Al final:
--   1. total_gastos  → recalculado por SUM(gasto.monto)
--   2. total_real_libres → monto_libres − ahorro_fijo − total_gastos
-- =============================================================

-- ==============================================================
-- SEMANA 1 — 2026-04-06 (Lunes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Isaul',
    280.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    260.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Aceite motor Honda Wave',
    350.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Agua y garrafón',
    80.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Papelería y copias',
    120.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-06'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Recargas teléfono',
    150.00,
    1;

-- ==============================================================
-- SEMANA 1 — 2026-04-07 (Martes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-07'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Josué',
    240.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-07'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    270.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-07'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Reparación cadena moto Emmanuel',
    450.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-07'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Comidas supervisión campo',
    200.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-07'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Material de oficina',
    180.00,
    1;

-- ==============================================================
-- SEMANA 1 — 2026-04-08 (Miércoles)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Isaul',
    290.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Combustible zona norte',
    320.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Cambio de llantas moto Isaul',
    750.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Impresión contratos',
    95.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Agua y garrafón',
    80.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-08'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Recargas teléfono',
    150.00,
    1;

-- ==============================================================
-- SEMANA 1 — 2026-04-09 (Jueves)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    250.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Josué',
    230.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Revisión frenos moto Josué',
    300.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Servicio preventivo 3 motos',
    600.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Limpieza oficina',
    160.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-09'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Comidas supervisión campo',
    220.00,
    1;

-- ==============================================================
-- SEMANA 1 — 2026-04-10 (Viernes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Isaul',
    310.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina fin de semana',
    340.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Afinación moto zona sur',
    500.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Papelería y copias',
    110.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Material de oficina',
    190.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-10'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Recargas teléfono',
    150.00,
    1;

-- ==============================================================
-- SEMANA 2 — 2026-04-13 (Lunes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Josué',
    260.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    280.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Aceite motor Honda Wave',
    380.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Agua y garrafón',
    80.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Limpieza oficina',
    160.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-13'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Impresión contratos',
    90.00,
    1;

-- ==============================================================
-- SEMANA 2 — 2026-04-14 (Martes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Isaul',
    270.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Combustible zona norte',
    300.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Reparación cadena moto Emmanuel',
    480.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Papelería y copias',
    130.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Recargas teléfono',
    150.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-14'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Comidas supervisión campo',
    210.00,
    1;

-- ==============================================================
-- SEMANA 2 — 2026-04-15 (Miércoles)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    265.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Josué',
    245.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Servicio preventivo 3 motos',
    650.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Agua y garrafón',
    80.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Material de oficina',
    175.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-15'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Impresión contratos',
    100.00,
    1;

-- ==============================================================
-- SEMANA 2 — 2026-04-16 (Jueves)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Isaul',
    285.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Emmanuel',
    255.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Revisión frenos moto Josué',
    320.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Afinación moto zona sur',
    520.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Recargas teléfono',
    150.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-16'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Limpieza oficina',
    160.00,
    1;

-- ==============================================================
-- SEMANA 2 — 2026-04-17 (Viernes)
-- ==============================================================

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina Josué',
    295.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gasolina'),
    'Gasolina fin de semana',
    350.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Servicio de Motos'),
    'Cambio de llantas moto Isaul',
    780.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Papelería y copias',
    115.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Comidas supervisión campo',
    230.00,
    1;

INSERT INTO gasto (caja_dia_id, categoria_gasto_id, concepto, monto, registrado_por)
SELECT
    (SELECT id FROM caja_dia WHERE sucursal_id = 1 AND fecha = '2026-04-17'),
    (SELECT id FROM categoria_gasto WHERE sucursal_id = 1 AND nombre = 'Gastos Varios'),
    'Material de oficina',
    185.00,
    1;

-- ==============================================================
-- RECALCULAR total_gastos para las 10 cajas afectadas
-- Suma todos los gastos no eliminados vinculados a cada caja.
-- ==============================================================

UPDATE caja_dia cd
SET total_gastos = (
    SELECT COALESCE(SUM(g.monto), 0)
    FROM gasto g
    WHERE g.caja_dia_id = cd.id AND g.deleted_at IS NULL
)
WHERE cd.sucursal_id = 1
  AND cd.fecha IN (
      '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17'
  );

-- ==============================================================
-- RECALCULAR total_real_libres
-- Nueva fórmula: monto_libres − ahorro_fijo − total_gastos
-- ==============================================================

UPDATE caja_dia
SET total_real_libres = monto_libres - ahorro_fijo - total_gastos
WHERE sucursal_id = 1
  AND fecha IN (
      '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17'
  );
