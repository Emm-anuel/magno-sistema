-- Conserva el plazo elegido cuando un monto coincide con más de un rango.
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS plazo_nuevo INTEGER;

-- Las solicitudes históricas pueden obtenerlo del crédito ya generado.
UPDATE renovaciones r
SET plazo_nuevo = c.plazo_dias
FROM creditos c
WHERE r.credito_nuevo_id = c.id
  AND r.plazo_nuevo IS NULL;
