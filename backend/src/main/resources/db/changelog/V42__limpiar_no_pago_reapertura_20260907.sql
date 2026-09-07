-- Limpieza puntual del cierre/reapertura ocurrido al abrir la caja el
-- 2026-09-07. El crédito #332 se usa únicamente para identificar la sucursal;
-- el lote incluye todos los no-pagos automáticos creados en el mismo minuto
-- que la apertura de esa caja.
--
-- La reparación es conservadora:
--   * solo toca registros con la razón automática exacta del cierre;
--   * excluye pagos modificados y cuotas con otro pago o abono posterior;
--   * excluye multas cobradas, condonadas o usadas en una renovación;
--   * usa borrado lógico para conservar la auditoría financiera.

CREATE TEMP TABLE tmp_no_pago_reapertura_20260907 AS
SELECT DISTINCT
       p.id  AS pago_id,
       cp.id AS calendario_pago_id
FROM   caja_dia cd
JOIN   creditos credito_referencia
       ON credito_referencia.id = 332
      AND credito_referencia.sucursal_id = cd.sucursal_id
JOIN   creditos c
       ON c.sucursal_id = cd.sucursal_id
      AND c.estado = 'ACTIVO'
      AND c.deleted_at IS NULL
JOIN   calendario_pagos cp
       ON cp.credito_id = c.id
      AND cp.fecha_programada = cd.fecha
      AND cp.estado = 'NO_PAGADO'
JOIN   pagos p
       ON p.calendario_pago_id = cp.id
      AND p.credito_id = c.id
      AND p.fecha_pago = cd.fecha
      AND p.monto_recibido = 0
      AND p.es_completo = false
      AND p.razon_no_pago = 'Cierre de caja — sin registro de pago'
      AND p.modificado_por IS NULL
      AND p.fecha_modificacion IS NULL
      AND p.deleted_at IS NULL
WHERE  cd.fecha = DATE '2026-09-07'
  AND  p.created_at >= date_trunc('minute', cd.fecha_hora_apertura)
  AND  p.created_at <  date_trunc('minute', cd.fecha_hora_apertura) + INTERVAL '1 minute'
  AND  NOT EXISTS (
           SELECT 1
           FROM pagos otro_pago
           WHERE otro_pago.calendario_pago_id = cp.id
             AND otro_pago.id <> p.id
             AND otro_pago.deleted_at IS NULL
       )
  AND  NOT EXISTS (
           SELECT 1
           FROM abono_coberturas cobertura
           WHERE cobertura.calendario_pago_id = cp.id
       )
  AND  NOT EXISTS (
           SELECT 1
           FROM multas multa_con_actividad
           WHERE multa_con_actividad.pago_id = p.id
             AND multa_con_actividad.deleted_at IS NULL
             AND (
                 multa_con_actividad.cobrada = true
                 OR multa_con_actividad.condonada = true
                 OR multa_con_actividad.cobrada_en_pago_id IS NOT NULL
                 OR multa_con_actividad.cobrada_en_abono_id IS NOT NULL
                 OR multa_con_actividad.condonada_en_renovacion_id IS NOT NULL
             )
       );

UPDATE multas
SET    deleted_at = now(),
       updated_at = now()
WHERE  pago_id IN (SELECT pago_id FROM tmp_no_pago_reapertura_20260907)
  AND  deleted_at IS NULL
  AND  cobrada = false
  AND  condonada = false;

UPDATE pagos
SET    deleted_at = now(),
       updated_at = now()
WHERE  id IN (SELECT pago_id FROM tmp_no_pago_reapertura_20260907);

UPDATE calendario_pagos
SET    estado = 'PENDIENTE',
       updated_at = now()
WHERE  id IN (SELECT calendario_pago_id FROM tmp_no_pago_reapertura_20260907)
  AND  estado = 'NO_PAGADO';

DROP TABLE tmp_no_pago_reapertura_20260907;
