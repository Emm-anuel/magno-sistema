-- Corrección: el primer pago de créditos activos debe caer al día siguiente del
-- desembolso, no el mismo día. Se desplaza cada pago PENDIENTE / ADELANTADO al
-- siguiente día hábil de su fecha actual. Los pagos ya cobrados no se alteran.

-- ── 1. Función auxiliar: siguiente día hábil para una sucursal ────────────────
CREATE OR REPLACE FUNCTION magno_next_business_day(p_fecha DATE, p_sucursal_id BIGINT)
RETURNS DATE
LANGUAGE plpgsql AS $$
DECLARE
    d DATE := p_fecha + 1;
BEGIN
    LOOP
        -- sábado (6) o domingo (0)
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

-- ── 2. Desplazar pagos PENDIENTE y ADELANTADO de créditos afectados ───────────
--
-- Un crédito está "afectado" cuando su pago #1 tiene la misma fecha que
-- fecha_inicio del crédito (el bug antiguo).
--
UPDATE calendario_pagos cp
SET    fecha_programada = magno_next_business_day(cp.fecha_programada, c.sucursal_id),
       updated_at       = now()
FROM   creditos c
WHERE  cp.credito_id = c.id
  AND  cp.estado IN ('PENDIENTE', 'ADELANTADO')
  AND  EXISTS (
           -- el crédito tiene pago #1 en la misma fecha que fecha_inicio
           SELECT 1
           FROM   calendario_pagos p1
           WHERE  p1.credito_id  = c.id
             AND  p1.numero_pago = 1
             AND  p1.fecha_programada = c.fecha_inicio
       );

-- ── 3. Actualizar fecha_vencimiento del crédito ───────────────────────────────
UPDATE creditos c
SET    fecha_vencimiento = (
           SELECT MAX(cp.fecha_programada)
           FROM   calendario_pagos cp
           WHERE  cp.credito_id = c.id
       ),
       updated_at = now()
WHERE  EXISTS (
           SELECT 1
           FROM   calendario_pagos p1
           WHERE  p1.credito_id  = c.id
             AND  p1.numero_pago = 1
             -- ya fue desplazado en el paso 2; la fecha ahora es > fecha_inicio
             AND  p1.fecha_programada > c.fecha_inicio
       );

-- ── 4. Limpiar función auxiliar ───────────────────────────────────────────────
DROP FUNCTION magno_next_business_day(DATE, BIGINT);
