-- =============================================================
-- MAGNO — V32: Seed — 2 solicitudes APROBADAS listas para desembolsar
--
--  1. Rosa Mendoza García  → Crédito Nuevo  $18,000 APROBADO  (campos completos)
--  2. Juan Torres Vega     → Crédito Activo $12,000 (crédito anterior para renovación)
--                          → Renovación     $16,000 APROBADO  (campos completos)
-- =============================================================

DO $$
DECLARE
    v_cliente1_id   BIGINT;
    v_cliente2_id   BIGINT;
    v_cred_activo   BIGINT;
    v_cred_nuevo    BIGINT;
    v_renovacion_id BIGINT;
BEGIN
    -- Idempotencia: si ya existe, no re-insertar
    IF EXISTS (SELECT 1 FROM clientes WHERE curp = 'MEGR900115MDFNDX01') THEN
        RETURN;
    END IF;

    -- Sincronizar secuencias ANTES de insertar para evitar conflictos de PK
    PERFORM setval(pg_get_serial_sequence('clientes',          'id'), COALESCE((SELECT MAX(id) FROM clientes),          0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('creditos',          'id'), COALESCE((SELECT MAX(id) FROM creditos),          0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('calendario_pagos',  'id'), COALESCE((SELECT MAX(id) FROM calendario_pagos),  0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('multas',            'id'), COALESCE((SELECT MAX(id) FROM multas),            0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('renovaciones',      'id'), COALESCE((SELECT MAX(id) FROM renovaciones),      0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('cliente_documentos','id'), COALESCE((SELECT MAX(id) FROM cliente_documentos), 0) + 1, false);

    -- ──────────────────────────────────────────────────────────────
    -- CLIENTE 1 — Rosa Mendoza García (para Crédito Nuevo)
    -- ──────────────────────────────────────────────────────────────
    INSERT INTO clientes (
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, genero, estado_civil, nombre_conyuge,
        telefono_fijo, celular,
        ine_tipo, ine_numero, curp, rfc,
        dom_calle, dom_no_exterior, dom_no_interior,
        dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
        dom_tipo_vivienda, dom_monto_renta,
        negocio_nombre, negocio_giro, negocio_antiguedad,
        negocio_calle, negocio_no_exterior, negocio_colonia,
        negocio_municipio, negocio_estado, negocio_cp,
        negocio_tipo_local, negocio_monto_renta, negocio_horarios,
        negocio_lat, negocio_lng,
        ingresos_semanales, gastos_semanales, gastos_renta, gastos_otros,
        ref1_nombre, ref1_telefono, ref1_parentesco,
        ref2_nombre, ref2_telefono, ref2_parentesco,
        aval_nombre, aval_telefono, aval_direccion, aval_identificacion,
        asesor_id, sucursal_id, created_by
    ) VALUES (
        'Rosa', 'Mendoza', 'García',
        '1990-01-15', 'FEMENINO', 'CASADO', 'Carlos Ramírez López',
        '5512345678', '5587654321',
        'INE', 'MXGA901234567890', 'MEGR900115MDFNDX01', 'MEGR900115AB1',
        'Calle Morelos', '47', 'Interior 2',
        'San Juan Tlihuaca', 'Ecatepec de Morelos', 'Estado de México', '55100',
        'PROPIA', NULL,
        'Salón de Belleza Rosita', 'Servicios de Belleza y Estética', '5 años',
        'Mercado Hidalgo', 'Local 45', 'Centro',
        'Ecatepec de Morelos', 'Estado de México', '55000',
        'PROPIO', NULL, 'Lunes a Sábado 9:00–19:00',
        19.601200, -99.060000,
        5200.00, 2100.00, 0.00, 800.00,
        'María García López',   '5591234567', 'Hermana',
        'Pedro Mendoza Torres', '5598765432', 'Padre',
        'Carmen López Vidal', '5587651234',
        'Calle Juárez 12, Col. Centro, Ecatepec, EdoMex',
        'INE-MX-8374619201',
        1, 1, 1
    ) RETURNING id INTO v_cliente1_id;

    INSERT INTO cliente_documentos (cliente_id, tipo, url, nombre, created_by) VALUES
        (v_cliente1_id, 'INE_FRENTE',      'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente1_id || '/ine-frente.jpg',      'INE Frente',            1),
        (v_cliente1_id, 'INE_REVERSO',     'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente1_id || '/ine-reverso.jpg',     'INE Reverso',           1),
        (v_cliente1_id, 'COMPROBANTE_DOM', 'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente1_id || '/comprobante-dom.jpg', 'Comprobante Domicilio', 1),
        (v_cliente1_id, 'FOTO_NEGOCIO',    'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente1_id || '/negocio-1.jpg',       'Foto Negocio 1',        1),
        (v_cliente1_id, 'FOTO_NEGOCIO',    'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente1_id || '/negocio-2.jpg',       'Foto Negocio 2',        1);

    -- ──────────────────────────────────────────────────────────────
    -- CRÉDITO NUEVO — $18,000 · 24% · 25 días · DIARIO · APROBADO
    --   cargo=4,320 | total=22,320 | pago=893 | pago_adelantado=888
    -- ──────────────────────────────────────────────────────────────
    INSERT INTO creditos (
        cliente_id, asesor_id, sucursal_id,
        monto_solicitado, monto_capital,
        tasa_interes, cargo_financiero, total_a_pagar,
        pago_periodico, plazo_dias, tipo_pago, pago_adelantado,
        tipo, estado,
        monto_aprobado, observaciones, fecha_aprobacion, aprobado_por,
        garantia_descripcion, evidencia_urls, lugar
    ) VALUES (
        v_cliente1_id, 1, 1,
        18000.00, 18000.00,
        0.2400, 4320.00, 22320.00,
        893.00, 25, 'DIARIO', 888.00,
        'NUEVO', 'APROBADO',
        18000.00,
        'Cliente con negocio establecido y 5 años de antigüedad. Se verificó INE vigente, comprobante de domicilio reciente y fotografías del negocio. Capacidad de pago confirmada: ingresos semanales $5,200 con gastos $2,900.',
        NOW() - INTERVAL '4 hours', 1,
        'Dos sillas hidráulicas marca Takara Belmont valuadas en $12,000 c/u, secadora profesional Parlux 385 y vaporizador capilar Gamma Più.',
        ARRAY[
            'https://magno-dev.s3.amazonaws.com/creditos/c1-negocio-exterior.jpg',
            'https://magno-dev.s3.amazonaws.com/creditos/c1-negocio-interior.jpg',
            'https://magno-dev.s3.amazonaws.com/creditos/c1-garantia-sillas.jpg'
        ],
        'Salón de Belleza Rosita — Mercado Hidalgo Local 45, Centro, Ecatepec'
    ) RETURNING id INTO v_cred_nuevo;

    -- ──────────────────────────────────────────────────────────────
    -- CLIENTE 2 — Juan Torres Vega (para Renovación)
    -- ──────────────────────────────────────────────────────────────
    INSERT INTO clientes (
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, genero, estado_civil,
        telefono_fijo, celular,
        ine_tipo, ine_numero, curp, rfc,
        dom_calle, dom_no_exterior,
        dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
        dom_tipo_vivienda, dom_monto_renta,
        negocio_nombre, negocio_giro, negocio_antiguedad,
        negocio_calle, negocio_no_exterior, negocio_colonia,
        negocio_municipio, negocio_estado, negocio_cp,
        negocio_tipo_local, negocio_monto_renta, negocio_horarios,
        negocio_lat, negocio_lng,
        ingresos_semanales, gastos_semanales, gastos_renta, gastos_otros,
        ref1_nombre, ref1_telefono, ref1_parentesco,
        ref2_nombre, ref2_telefono, ref2_parentesco,
        asesor_id, sucursal_id, created_by
    ) VALUES (
        'Juan', 'Torres', 'Vega',
        '1985-06-22', 'MASCULINO', 'UNION_LIBRE',
        '5523456789', '5576543210',
        'INE', 'MXTO851234567890', 'TOVJ850622HDFRVX08', 'TOVJ850622HK3',
        'Av. Aztecas', '112',
        'Metropolitana Segunda Sección', 'Nezahualcóyotl', 'Estado de México', '57750',
        'RENTADA', 1800.00,
        'Abarrotería El Güero', 'Comercio al Menudeo — Abarrotes y Refrescos', '8 años',
        'Calle 13 de Septiembre', '55', 'Metropolitana Segunda Sección',
        'Nezahualcóyotl', 'Estado de México', '57750',
        'RENTADO', 2500.00, 'Lunes a Domingo 7:00–21:00',
        19.402100, -99.020000,
        7500.00, 3200.00, 1800.00, 600.00,
        'Lucía Vega Morales',    '5512387654', 'Madre',
        'Roberto Torres Cruz',   '5589012345', 'Hermano',
        1, 1, 1
    ) RETURNING id INTO v_cliente2_id;

    INSERT INTO cliente_documentos (cliente_id, tipo, url, nombre, created_by) VALUES
        (v_cliente2_id, 'INE_FRENTE',      'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente2_id || '/ine-frente.jpg',      'INE Frente',            1),
        (v_cliente2_id, 'INE_REVERSO',     'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente2_id || '/ine-reverso.jpg',     'INE Reverso',           1),
        (v_cliente2_id, 'COMPROBANTE_DOM', 'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente2_id || '/comprobante-dom.jpg', 'Comprobante Domicilio', 1),
        (v_cliente2_id, 'FOTO_NEGOCIO',    'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente2_id || '/negocio-1.jpg',       'Foto Negocio 1',        1),
        (v_cliente2_id, 'FOTO_NEGOCIO',    'https://magno-dev.s3.amazonaws.com/clientes/' || v_cliente2_id || '/negocio-2.jpg',       'Foto Negocio 2',        1);

    -- ──────────────────────────────────────────────────────────────
    -- CRÉDITO ANTERIOR (ACTIVO) — $12,000 · 30% · 25 días · DIARIO
    --   cargo=3,600 | total=15,600 | pago=624 | pago_adelantado=624
    --   Iniciado 2026-06-09, vence 2026-07-11, 3 pagos pendientes
    -- ──────────────────────────────────────────────────────────────
    INSERT INTO creditos (
        cliente_id, asesor_id, sucursal_id,
        monto_solicitado, monto_capital,
        tasa_interes, cargo_financiero, total_a_pagar,
        pago_periodico, plazo_dias, tipo_pago, pago_adelantado,
        tipo, estado,
        monto_aprobado, observaciones, fecha_aprobacion, aprobado_por,
        fecha_desembolso,
        garantia_descripcion, evidencia_urls, lugar,
        fecha_inicio, fecha_vencimiento
    ) VALUES (
        v_cliente2_id, 1, 1,
        12000.00, 12000.00,
        0.3000, 3600.00, 15600.00,
        624.00, 25, 'DIARIO', 624.00,
        'NUEVO', 'ACTIVO',
        12000.00,
        'Primer crédito del cliente. Negocio con alta rotación de inventario y buena ubicación.',
        '2026-06-08 10:30:00+00', 1,
        '2026-06-09 09:15:00+00',
        'Refrigerador de 2 puertas Samsung modelo RT29 y horno microondas LG 30L.',
        ARRAY[
            'https://magno-dev.s3.amazonaws.com/creditos/c2-negocio-exterior.jpg',
            'https://magno-dev.s3.amazonaws.com/creditos/c2-negocio-interior.jpg'
        ],
        'Abarrotería El Güero — Calle 13 Sep. 55, Col. Metropolitana, Neza',
        '2026-06-09', '2026-07-11'
    ) RETURNING id INTO v_cred_activo;

    -- Calendario de pagos del crédito anterior (25 entradas)
    -- Días 1-21 PAGADO · Día 22 NO_PAGADO (multa $50) · Días 23-24 PENDIENTE · Día 25 ADELANTADO
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado) VALUES
        (v_cred_activo,  1, '2026-06-09', 624.00, 'PAGADO'),
        (v_cred_activo,  2, '2026-06-10', 624.00, 'PAGADO'),
        (v_cred_activo,  3, '2026-06-11', 624.00, 'PAGADO'),
        (v_cred_activo,  4, '2026-06-12', 624.00, 'PAGADO'),
        (v_cred_activo,  5, '2026-06-13', 624.00, 'PAGADO'),
        (v_cred_activo,  6, '2026-06-16', 624.00, 'PAGADO'),
        (v_cred_activo,  7, '2026-06-17', 624.00, 'PAGADO'),
        (v_cred_activo,  8, '2026-06-18', 624.00, 'PAGADO'),
        (v_cred_activo,  9, '2026-06-19', 624.00, 'PAGADO'),
        (v_cred_activo, 10, '2026-06-20', 624.00, 'PAGADO'),
        (v_cred_activo, 11, '2026-06-23', 624.00, 'PAGADO'),
        (v_cred_activo, 12, '2026-06-24', 624.00, 'PAGADO'),
        (v_cred_activo, 13, '2026-06-25', 624.00, 'PAGADO'),
        (v_cred_activo, 14, '2026-06-26', 624.00, 'PAGADO'),
        (v_cred_activo, 15, '2026-06-27', 624.00, 'PAGADO'),
        (v_cred_activo, 16, '2026-06-30', 624.00, 'PAGADO'),
        (v_cred_activo, 17, '2026-07-01', 624.00, 'PAGADO'),
        (v_cred_activo, 18, '2026-07-02', 624.00, 'PAGADO'),
        (v_cred_activo, 19, '2026-07-03', 624.00, 'PAGADO'),
        (v_cred_activo, 20, '2026-07-04', 624.00, 'PAGADO'),
        (v_cred_activo, 21, '2026-07-07', 624.00, 'PAGADO'),
        (v_cred_activo, 22, '2026-07-08', 624.00, 'NO_PAGADO'),
        (v_cred_activo, 23, '2026-07-09', 624.00, 'PENDIENTE'),
        (v_cred_activo, 24, '2026-07-10', 624.00, 'PENDIENTE'),
        (v_cred_activo, 25, '2026-07-11', 624.00, 'ADELANTADO');

    -- Multa generada por el pago 22 no realizado (Jul 8)
    INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
    VALUES (v_cliente2_id, v_cred_activo, 'NO_PAGO', 50.00, '2026-07-08', FALSE);

    -- ──────────────────────────────────────────────────────────────
    -- RENOVACIÓN — $16,000 · 24% · 25 días · DIARIO · APROBADO
    --   pago_nuevo=794 | pago_adelantado=784
    --   pagos_restantes=3 | monto_pend=1,872 | multas=50
    --   desembolso = 16,000 − 1,872 − 50 − 784 = 13,294
    -- ──────────────────────────────────────────────────────────────
    INSERT INTO renovaciones (
        credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
        estado, aprobado_por, fecha_aprobacion, monto_aprobado,
        monto_nuevo, tipo_pago, fecha,
        pagos_restantes, monto_pagos_restantes,
        multas_pendientes, multas_condonadas,
        pago_adelantado, monto_desembolso,
        garantia_descripcion, evidencia_urls,
        created_by
    ) VALUES (
        v_cred_activo, NULL, v_cliente2_id, 1,
        'APROBADO', 1, NOW() - INTERVAL '2 hours', 16000.00,
        16000.00, 'DIARIO', '2026-07-12',
        3, 1872.00,
        50.00, 0.00,
        784.00, 13294.00,
        'Refrigerador Samsung RT29 existente + vitrina exhibidora de refrescos Torrey VR-26 nueva.',
        ARRAY[
            'https://magno-dev.s3.amazonaws.com/renovaciones/r1-negocio-frente.jpg',
            'https://magno-dev.s3.amazonaws.com/renovaciones/r1-garantia-refri.jpg',
            'https://magno-dev.s3.amazonaws.com/renovaciones/r1-garantia-vitrina.jpg'
        ],
        1
    ) RETURNING id INTO v_renovacion_id;

    -- Sincronizar secuencias BIGSERIAL
    PERFORM setval(pg_get_serial_sequence('clientes',          'id'), COALESCE((SELECT MAX(id) FROM clientes),          0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('creditos',          'id'), COALESCE((SELECT MAX(id) FROM creditos),          0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('calendario_pagos',  'id'), COALESCE((SELECT MAX(id) FROM calendario_pagos),  0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('multas',            'id'), COALESCE((SELECT MAX(id) FROM multas),            0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('renovaciones',      'id'), COALESCE((SELECT MAX(id) FROM renovaciones),      0) + 1, false);
    PERFORM setval(pg_get_serial_sequence('cliente_documentos','id'), COALESCE((SELECT MAX(id) FROM cliente_documentos), 0) + 1, false);

END $$;
