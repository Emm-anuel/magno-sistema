-- MAGNO — V14: Soporte para créditos semanales con multas configurables
-- Agrega configuración de multas específicas para créditos semanales

-- 1. Agregar campos de multas semanales a config_multas
ALTER TABLE config_multas
    ADD COLUMN
IF NOT EXISTS multa_semanal_no_pago      DECIMAL
(12,2) DEFAULT 300.00,
ADD COLUMN
IF NOT EXISTS multa_semanal_incompletos  DECIMAL
(12,2) DEFAULT 300.00;

-- 2. Backfill para registros existentes
UPDATE config_multas
SET 
    multa_semanal_no_pago = 300.00,
    multa_semanal_incompletos = 300.00
WHERE multa_semanal_no_pago IS NULL;
