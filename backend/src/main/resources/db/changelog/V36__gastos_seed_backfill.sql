-- =============================================================
-- MAGNO — V36: Backfill de categorías de gasto
--
-- V19 sembró las categorías iniciales solo para las sucursales que
-- existían en ese momento. Las sucursales creadas después (antes de
-- que SucursalService.crear() sembrara categorías automáticamente)
-- se quedaron sin catálogo de gastos, bloqueando el registro de
-- gastos para esas sucursales. Este script aplica el mismo backfill
-- idempotente de V19 a cualquier sucursal que aún no tenga estas
-- categorías.
-- =============================================================

INSERT INTO categoria_gasto (sucursal_id, nombre, activo)
SELECT s.id, 'Gasolina', TRUE
FROM sucursales s
WHERE NOT EXISTS (
    SELECT 1 FROM categoria_gasto cg
    WHERE cg.sucursal_id = s.id AND cg.nombre = 'Gasolina'
);

INSERT INTO categoria_gasto (sucursal_id, nombre, activo)
SELECT s.id, 'Servicio de Motos', TRUE
FROM sucursales s
WHERE NOT EXISTS (
    SELECT 1 FROM categoria_gasto cg
    WHERE cg.sucursal_id = s.id AND cg.nombre = 'Servicio de Motos'
);

INSERT INTO categoria_gasto (sucursal_id, nombre, activo)
SELECT s.id, 'Gastos Varios', TRUE
FROM sucursales s
WHERE NOT EXISTS (
    SELECT 1 FROM categoria_gasto cg
    WHERE cg.sucursal_id = s.id AND cg.nombre = 'Gastos Varios'
);
