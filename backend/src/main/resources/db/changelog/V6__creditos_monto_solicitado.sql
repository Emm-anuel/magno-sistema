-- =============================================================
-- V6: Persistir monto solicitado del crédito sin perder histórico
-- =============================================================

ALTER TABLE creditos
    ADD COLUMN
IF NOT EXISTS monto_solicitado DECIMAL
(12,2);

UPDATE creditos
SET monto_solicitado = monto_capital
WHERE monto_solicitado IS NULL;

ALTER TABLE creditos
    ALTER COLUMN monto_solicitado
SET
NOT NULL;
