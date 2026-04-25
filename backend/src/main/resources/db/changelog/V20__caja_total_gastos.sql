-- =============================================================
-- MAGNO — V20: Add total_gastos to caja_dia
--
-- total_gastos: suma de gastos del día al momento del cierre.
-- total_real_libres formula updated: monto_libres − ahorro_fijo − total_gastos
-- =============================================================

ALTER TABLE caja_dia
    ADD COLUMN total_gastos DECIMAL(12,2);
