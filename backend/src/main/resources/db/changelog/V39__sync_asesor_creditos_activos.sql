-- Repara transferencias de cartera previas: la ruta de cobro usa el asesor
-- del crédito activo, mientras la asignación vigente pertenece al cliente.
UPDATE creditos AS credito
SET asesor_id = cliente.asesor_id,
    updated_at = CURRENT_TIMESTAMP
FROM clientes AS cliente
WHERE credito.cliente_id = cliente.id
  AND credito.estado = 'ACTIVO'
  AND credito.deleted_at IS NULL
  AND cliente.asesor_id IS NOT NULL
  AND credito.asesor_id IS DISTINCT FROM cliente.asesor_id;
