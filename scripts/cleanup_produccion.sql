-- =============================================================
-- MAGNO — Limpieza de datos previo a producción
--
-- QUÉ HACE:
--   Elimina todos los datos transaccionales de prueba y reinicia
--   las secuencias de ID de las tablas afectadas.
--
-- QUÉ CONSERVA:
--   sucursales, roles, usuarios
--   config_multas, config_sucursal, config_rangos_credito
--   config_umbrales_renovacion, dias_festivos
--   categoria_gasto, conceptos_inversion, nomina_personal
--
-- CÓMO EJECUTAR (una sola vez, antes de ir a producción):
--   psql -h <host> -U <user> -d <dbname> -f cleanup_produccion.sql
--
-- ADVERTENCIA: Esta operación es IRREVERSIBLE.
--              Hacer backup antes de ejecutar en producción.
-- =============================================================

BEGIN;

-- ------------------------------------------------------------------
-- PASO 1 — Verificación previa
--   Muestra conteos actuales para confirmar qué se va a borrar.
--   Revisa estos números antes de hacer COMMIT.
-- ------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '=== CONTEOS ANTES DE LIMPIAR ===';
    RAISE NOTICE 'clientes:                %', (SELECT COUNT(*) FROM clientes);
    RAISE NOTICE 'creditos:                %', (SELECT COUNT(*) FROM creditos);
    RAISE NOTICE 'pagos:                   %', (SELECT COUNT(*) FROM pagos);
    RAISE NOTICE 'multas:                  %', (SELECT COUNT(*) FROM multas);
    RAISE NOTICE 'calendario_pagos:        %', (SELECT COUNT(*) FROM calendario_pagos);
    RAISE NOTICE 'renovaciones:            %', (SELECT COUNT(*) FROM renovaciones);
    RAISE NOTICE 'colocaciones:            %', (SELECT COUNT(*) FROM colocaciones);
    RAISE NOTICE 'abonos_corriente:        %', (SELECT COUNT(*) FROM abonos_corriente);
    RAISE NOTICE 'abono_coberturas:        %', (SELECT COUNT(*) FROM abono_coberturas);
    RAISE NOTICE 'cliente_documentos:      %', (SELECT COUNT(*) FROM cliente_documentos);
    RAISE NOTICE 'caja_dia:                %', (SELECT COUNT(*) FROM caja_dia);
    RAISE NOTICE 'caja_movimiento_inv:     %', (SELECT COUNT(*) FROM caja_movimiento_inversion);
    RAISE NOTICE 'gasto:                   %', (SELECT COUNT(*) FROM gasto);
    RAISE NOTICE 'nomina_pago:             %', (SELECT COUNT(*) FROM nomina_pago);
    RAISE NOTICE 'aperturas_caja (legacy): %', (SELECT COUNT(*) FROM aperturas_caja);
    RAISE NOTICE 'cortes_caja (legacy):    %', (SELECT COUNT(*) FROM cortes_caja);
    RAISE NOTICE 'bitacora:                %', (SELECT COUNT(*) FROM bitacora);
    RAISE NOTICE 'bitacora_config:         %', (SELECT COUNT(*) FROM bitacora_config);
    RAISE NOTICE '=================================';
    RAISE NOTICE 'CONSERVADOS:';
    RAISE NOTICE 'usuarios:                %', (SELECT COUNT(*) FROM usuarios);
    RAISE NOTICE 'sucursales:              %', (SELECT COUNT(*) FROM sucursales);
    RAISE NOTICE 'nomina_personal:         %', (SELECT COUNT(*) FROM nomina_personal WHERE deleted_at IS NULL);
    RAISE NOTICE 'dias_festivos:           %', (SELECT COUNT(*) FROM dias_festivos);
    RAISE NOTICE 'categoria_gasto:         %', (SELECT COUNT(*) FROM categoria_gasto WHERE activo = TRUE);
    RAISE NOTICE 'conceptos_inversion:     %', (SELECT COUNT(*) FROM conceptos_inversion WHERE deleted_at IS NULL);
    RAISE NOTICE '=================================';
END $$;

-- ------------------------------------------------------------------
-- PASO 2 — Borrar todos los datos transaccionales y reiniciar IDs
--
-- Se listan todas las tablas en un solo TRUNCATE para que PostgreSQL
-- resuelva internamente las dependencias de FK entre ellas.
-- RESTART IDENTITY reinicia todas las secuencias a 1.
-- ------------------------------------------------------------------
TRUNCATE TABLE
    bitacora,
    bitacora_config,
    multas,
    abono_coberturas,
    pagos,
    abonos_corriente,
    colocaciones,
    renovaciones,
    calendario_pagos,
    cliente_documentos,
    creditos,
    clientes,
    nomina_pago,
    gasto,
    caja_movimiento_inversion,
    caja_dia,
    cortes_caja,
    aperturas_caja
RESTART IDENTITY;

-- ------------------------------------------------------------------
-- PASO 3 — Resetear el contador de numeración de clientes
--   Cada sucursal arranca desde cero para asignar números limpios.
-- ------------------------------------------------------------------
UPDATE sucursales SET numero_secuencial = 0;

-- ------------------------------------------------------------------
-- PASO 4 — Verificación posterior
--   Todas las tablas limpiadas deben mostrar 0.
--   Las tablas conservadas deben mantener sus conteos.
-- ------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';

    -- Tablas limpiadas — deben ser 0
    ASSERT (SELECT COUNT(*) FROM clientes)               = 0, 'clientes no vacío';
    ASSERT (SELECT COUNT(*) FROM creditos)               = 0, 'creditos no vacío';
    ASSERT (SELECT COUNT(*) FROM pagos)                  = 0, 'pagos no vacío';
    ASSERT (SELECT COUNT(*) FROM multas)                 = 0, 'multas no vacío';
    ASSERT (SELECT COUNT(*) FROM calendario_pagos)       = 0, 'calendario_pagos no vacío';
    ASSERT (SELECT COUNT(*) FROM renovaciones)           = 0, 'renovaciones no vacío';
    ASSERT (SELECT COUNT(*) FROM colocaciones)           = 0, 'colocaciones no vacío';
    ASSERT (SELECT COUNT(*) FROM abonos_corriente)       = 0, 'abonos_corriente no vacío';
    ASSERT (SELECT COUNT(*) FROM abono_coberturas)       = 0, 'abono_coberturas no vacío';
    ASSERT (SELECT COUNT(*) FROM cliente_documentos)     = 0, 'cliente_documentos no vacío';
    ASSERT (SELECT COUNT(*) FROM caja_dia)               = 0, 'caja_dia no vacío';
    ASSERT (SELECT COUNT(*) FROM caja_movimiento_inversion) = 0, 'caja_movimiento_inversion no vacío';
    ASSERT (SELECT COUNT(*) FROM gasto)                  = 0, 'gasto no vacío';
    ASSERT (SELECT COUNT(*) FROM nomina_pago)            = 0, 'nomina_pago no vacío';
    ASSERT (SELECT COUNT(*) FROM aperturas_caja)         = 0, 'aperturas_caja no vacío';
    ASSERT (SELECT COUNT(*) FROM cortes_caja)            = 0, 'cortes_caja no vacío';
    ASSERT (SELECT COUNT(*) FROM bitacora)               = 0, 'bitacora no vacío';
    ASSERT (SELECT COUNT(*) FROM bitacora_config)        = 0, 'bitacora_config no vacío';

    -- numero_secuencial debe ser 0 en todas las sucursales
    ASSERT (SELECT COUNT(*) FROM sucursales WHERE numero_secuencial != 0) = 0,
        'numero_secuencial no reseteado en alguna sucursal';

    -- Tablas conservadas — deben tener al menos 1 registro
    ASSERT (SELECT COUNT(*) FROM usuarios)   > 0, 'usuarios vacío — algo salió mal';
    ASSERT (SELECT COUNT(*) FROM sucursales) > 0, 'sucursales vacío — algo salió mal';
    ASSERT (SELECT COUNT(*) FROM roles)      > 0, 'roles vacío — algo salió mal';

    RAISE NOTICE 'OK — limpieza completada correctamente.';
    RAISE NOTICE 'Usuarios conservados:   %', (SELECT COUNT(*) FROM usuarios);
    RAISE NOTICE 'Sucursales conservadas: %', (SELECT COUNT(*) FROM sucursales);
END $$;

COMMIT;
