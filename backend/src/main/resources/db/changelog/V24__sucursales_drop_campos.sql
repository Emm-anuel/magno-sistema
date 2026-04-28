-- =============================================================
-- V24__sucursales_drop_campos.sql
-- Elimina campos que se gestionan desde configuracion/usuarios
-- =============================================================

ALTER TABLE sucursales
    DROP CONSTRAINT IF EXISTS fk_sucursales_responsable;

ALTER TABLE sucursales
    DROP COLUMN IF EXISTS responsable_id
,
DROP COLUMN
IF EXISTS multa_base,
DROP COLUMN
IF EXISTS ahorro_diario;
