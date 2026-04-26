-- =============================================================
-- MAGNO - V22: Remove legacy table `gastos`
--
-- Context:
-- - V1 created `gastos` (legacy model linked to `cortes_caja`).
-- - V18+ replaced the module with `gasto` + `categoria_gasto`.
-- - Current backend/frontend only use `gasto`.
--
-- Goal:
-- - Remove unused legacy table to avoid confusion in operations and support.
-- =============================================================

DROP TABLE IF EXISTS gastos;
