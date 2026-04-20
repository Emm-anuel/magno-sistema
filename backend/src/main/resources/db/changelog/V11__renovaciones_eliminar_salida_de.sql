-- MAGNO — Renovaciones: eliminar campo salida_de
-- Justificación: la modalidad caja/ruta ya no se solicita ni se usa en renovaciones.

ALTER TABLE renovaciones
    DROP COLUMN IF EXISTS salida_de;
