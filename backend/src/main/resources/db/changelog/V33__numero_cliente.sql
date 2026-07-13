-- Prefijo de numeración y contador por sucursal
ALTER TABLE sucursales ADD COLUMN prefijo VARCHAR(10);
ALTER TABLE sucursales ADD COLUMN numero_secuencial INTEGER NOT NULL DEFAULT 0;

-- Prefijos iniciales por nombre de sucursal
UPDATE sucursales SET prefijo = '01' WHERE LOWER(nombre) LIKE '%central%';
UPDATE sucursales SET prefijo = '02' WHERE LOWER(nombre) LIKE '%malinalco%';

-- Inicializar el contador con los clientes ya existentes por sucursal
UPDATE sucursales s
SET numero_secuencial = (
    SELECT COUNT(*) FROM clientes c WHERE c.sucursal_id = s.id
);

-- Número de cliente en tabla clientes
ALTER TABLE clientes ADD COLUMN numero_cliente VARCHAR(20);
ALTER TABLE clientes ADD CONSTRAINT uq_numero_cliente UNIQUE (numero_cliente);
