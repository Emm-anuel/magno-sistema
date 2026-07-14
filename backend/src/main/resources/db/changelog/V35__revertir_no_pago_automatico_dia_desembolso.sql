-- Corrección de seguimiento a V34: algunos créditos ya tenían su pago #1
-- marcado NO_PAGADO (con multa) por el cierre de caja automático ANTES de
-- que V34 corrigiera la fecha, porque V34 solo toca calendario_pagos en
-- estado PENDIENTE/ADELANTADO. Esos casos quedaron con fecha_programada
-- igual a fecha_inicio del crédito (el bug original) y una multa de $50/$300
-- generada injustamente, ya que el pago nunca debió considerarse vencido
-- ese día.
--
-- Alcance: únicamente los registros generados por el cierre de caja
-- automático (razon_no_pago = texto fijo de marcarNoPagoAutomatico). Los
-- "no pago" registrados manualmente por un asesor via ModalRegistrarPago no
-- se tocan aquí — requieren revisión caso por caso.

-- ── 1. Función auxiliar: siguiente día hábil para una sucursal ────────────────
CREATE OR REPLACE FUNCTION magno_next_business_day(p_fecha DATE, p_sucursal_id BIGINT)
RETURNS DATE
LANGUAGE plpgsql AS $$
DECLARE
    d DATE := p_fecha + 1;
BEGIN
    LOOP
        EXIT WHEN EXTRACT(DOW FROM d) NOT IN (0, 6)
              AND NOT EXISTS (
                  SELECT 1 FROM dias_festivos
                  WHERE fecha = d
                    AND (aplica_sucursal_id IS NULL OR aplica_sucursal_id = p_sucursal_id)
              );
        d := d + 1;
    END LOOP;
    RETURN d;
END;
$$;

-- ── 2. Identificar los pagos #1 afectados: NO_PAGADO por cierre automático,
--       en la misma fecha que fecha_inicio del crédito ────────────────────────
CREATE TEMP TABLE tmp_no_pago_afectados AS
SELECT cp.id AS calendario_pago_id, p.id AS pago_id, m.id AS multa_id, c.sucursal_id
FROM   calendario_pagos cp
JOIN   creditos c ON c.id = cp.credito_id
JOIN   pagos p    ON p.calendario_pago_id = cp.id
                 AND p.monto_recibido = 0
                 AND p.es_completo = false
                 AND p.razon_no_pago = 'Cierre de caja — sin registro de pago'
                 AND p.deleted_at IS NULL
LEFT JOIN multas m ON m.pago_id = p.id
                 AND m.tipo = 'NO_PAGO'
                 AND m.cobrada = false
                 AND m.condonada = false
                 AND m.deleted_at IS NULL
WHERE  cp.numero_pago = 1
  AND  cp.estado = 'NO_PAGADO'
  AND  cp.fecha_programada = c.fecha_inicio;

-- ── 3. Soft-delete de la multa injusta (si aún no fue cobrada ni condonada) ──
UPDATE multas
SET    deleted_at = now(),
       updated_at = now()
WHERE  id IN (SELECT multa_id FROM tmp_no_pago_afectados WHERE multa_id IS NOT NULL);

-- ── 4. Soft-delete del registro de "no pago" automático ──────────────────────
UPDATE pagos
SET    deleted_at = now(),
       updated_at = now()
WHERE  id IN (SELECT pago_id FROM tmp_no_pago_afectados);

-- ── 5. Revertir el calendario a PENDIENTE con la fecha correcta ──────────────
UPDATE calendario_pagos cp
SET    estado           = 'PENDIENTE',
       fecha_programada = magno_next_business_day(cp.fecha_programada, t.sucursal_id),
       updated_at       = now()
FROM   tmp_no_pago_afectados t
WHERE  cp.id = t.calendario_pago_id;

-- ── 6. Actualizar fecha_vencimiento de los créditos afectados ────────────────
UPDATE creditos c
SET    fecha_vencimiento = (
           SELECT MAX(cp.fecha_programada)
           FROM   calendario_pagos cp
           WHERE  cp.credito_id = c.id
       ),
       updated_at = now()
WHERE  c.id IN (
           SELECT cp.credito_id
           FROM   calendario_pagos cp
           JOIN   tmp_no_pago_afectados t ON t.calendario_pago_id = cp.id
       );

DROP TABLE tmp_no_pago_afectados;

-- ── 7. Limpiar función auxiliar ───────────────────────────────────────────────
DROP FUNCTION magno_next_business_day(DATE, BIGINT);
