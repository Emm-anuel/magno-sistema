-- =============================================================
-- MAGNO — Eliminar campo modalidad de tabla pagos
-- Changeset: V9__eliminar_modalidad_pagos.sql
-- Todos los cobros se realizan en ruta, el indicador es innecesario
-- =============================================================

-- Remover cualquier constraint CHECK asociada a la columna modalidad
DO $
$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
    SELECT DISTINCT n.nspname AS schema_name, c.conname AS constraint_name
    FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'pagos'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid)
    ILIKE '%modalidad%'
    LOOP
    EXECUTE format
    (
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            constraint_record.schema_name,
            'pagos',
            constraint_record.constraint_name
        );
END
LOOP;
END $$;

-- Remover la columna modalidad
ALTER TABLE pagos DROP COLUMN IF EXISTS modalidad;

-- Log
-- Tabla pagos actualizada: columna modalidad eliminada
