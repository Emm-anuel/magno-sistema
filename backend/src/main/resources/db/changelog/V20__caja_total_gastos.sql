-- =============================================================
-- MAGNO — V20: Add total_gastos to caja_dia
--
-- total_gastos: suma de gastos del día al momento del cierre.
-- NULL while caja is ABIERTA (same as other computed fields).
-- Closed cajas before this migration had no gastos → backfill 0.
-- New formula at close: total_real_libres = monto_libres − ahorro_fijo − total_gastos
-- =============================================================

ALTER TABLE caja_dia
    ADD COLUMN total_gastos DECIMAL(12,2);

-- Backfill already-closed cajas (no gastos existed before this module)
UPDATE caja_dia
SET total_gastos = 0
WHERE estado = 'CERRADA'
  AND total_gastos IS NULL;
