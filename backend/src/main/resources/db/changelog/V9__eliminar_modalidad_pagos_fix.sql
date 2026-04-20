-- =============================================================
-- MAGNO - Eliminar campo modalidad de tabla pagos
-- Changeset: V9__eliminar_modalidad_pagos_fix.sql
-- Todos los cobros se realizan en ruta, el indicador es innecesario
-- =============================================================

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_modalidad_check;
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS check_modalidad;
ALTER TABLE pagos DROP COLUMN IF EXISTS modalidad;