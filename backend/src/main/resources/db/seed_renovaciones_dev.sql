-- ============================================================
-- MAGNO — Seed de desarrollo COMPLETO v2.0
-- Archivo principal: invoca los 3 partes en orden.
--
-- Ejecutar con psql:
--   \i seed_renovaciones_dev.sql
-- O ejecutar cada parte individualmente:
--   \i seed_dev_01_base.sql
--   \i seed_dev_02_centro.sql
--   \i seed_dev_03_norte_sur.sql
--   \i seed_dev_04_semanales.sql
--
-- Contraseña de todos los usuarios demo: password123
-- Hash BCrypt v2a:
--   $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
--
-- CAMBIOS respecto al seed anterior (v1):
--   [FIX] Agrega monto_nuevo + tipo_pago NOT NULL en renovaciones (V12)
--   [FIX] Agrega tipo='RENOVACION' en créditos originados por renovación (V12)
--   [FIX] Elimina modalidad de pagos (columna removida en V9)
--   [FIX] Elimina salida_de de renovaciones (columna removida en V11)
--   [NEW] 3 sucursales: Centro, Norte, Sur
--   [NEW] 13 usuarios con los 4 roles en todas las sucursales
--   [NEW] 31 clientes con todos los estados y casos edge
--   [NEW] Cadena de 3 renovaciones encadenadas
--   [NEW] Solicitudes SOLICITADO, RECHAZADO con motivo
--   [NEW] Pagos registrados + multas por NO_PAGO e INCOMPLETO
--   [NEW] Coordenadas de negocio, documentos de clientes
-- ============================================================

\i
seed_dev_01_base.sql
\i seed_dev_02_centro.sql
\i seed_dev_03_norte_sur.sql
\i seed_dev_04_semanales.sql
