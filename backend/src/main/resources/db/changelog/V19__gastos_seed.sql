-- =============================================================
-- MAGNO — V19: Seeds de Gastos
--
-- Inserta categorías iniciales de gasto para cada sucursal
-- existente en la base de datos.
--
-- Categorías iniciales por sucursal:
--   - Gasolina
--   - Servicio de Motos
--   - Gastos Varios
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
