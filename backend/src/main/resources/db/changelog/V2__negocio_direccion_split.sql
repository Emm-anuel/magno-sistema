-- Divide la dirección del negocio en campos separados.
-- negocio_direccion se conserva para compatibilidad con datos existentes.

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS negocio_calle       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS negocio_no_exterior VARCHAR(20),
    ADD COLUMN IF NOT EXISTS negocio_no_interior VARCHAR(20),
    ADD COLUMN IF NOT EXISTS negocio_colonia     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS negocio_municipio   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS negocio_estado      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS negocio_cp          VARCHAR(10);
