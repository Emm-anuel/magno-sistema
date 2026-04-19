-- =============================================================
-- V7: Coordenadas geográficas del negocio del cliente
-- =============================================================

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS negocio_lat DECIMAL(10, 7),
    ADD COLUMN IF NOT EXISTS negocio_lng DECIMAL(10, 7);
