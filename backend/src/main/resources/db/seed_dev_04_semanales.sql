-- ============================================================
-- PARTE 4: Escenarios de Créditos Semanales
-- - 5+ créditos semanales en distintas etapas
-- - elegibles: 8 semanas (>=5 pagos), 12 semanas (>=9 pagos)
-- - 1 caso diario -> semanal por renovación
-- - 1 crédito semanal con multa pendiente de $300
-- ============================================================

DO $$
DECLARE
  v_suc_cen BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='suc_centro');
  v_admin   BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='admin');
  v_ase_c1  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c1');
  v_ase_c2  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c2');

  v_cl1 BIGINT;
  v_cl2 BIGINT;
  v_cl3 BIGINT;
  v_cl4 BIGINT;
  v_cl5 BIGINT;
  v_cl6 BIGINT;

  v_cr BIGINT;
  v_cr_ant BIGINT;
  v_cr_nuevo BIGINT;

  i INT;
BEGIN

-- Cliente 1: semanal 8 semanas, 3 pagos (en progreso)
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990001') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Paola','Mendoza','Ríos','1990-01-10',
    'FEMENINO','CASADO','7713990001','HGO-SW001','MERP900110MHFXXX01',
    'Calle Semanal','11','Centro','Pachuca','Hidalgo','42001',
    'Abarrotes Paola','Abarrotes','4 años',
    'Hermana Paola','7719000001','Hermana','Vecina Paola','7719000002','Vecina',
    v_ase_c1, v_suc_cen
  ) RETURNING id INTO v_cl1;
ELSE
  SELECT id INTO v_cl1 FROM clientes WHERE celular = '7713990001';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-SEMANAL-8W-3P') THEN
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl1, v_ase_c1, v_suc_cen,
    8000, 8000, 8000,
    0.40, 3200, 11200, 1400,
    8, 'SEMANAL', 1400, 'NUEVO',
    'SEED-SEMANAL-8W-3P',
    '2026-03-03', '2026-05-05', '2026-03-03 09:00:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr;

  FOR i IN 1..8 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr,
      i,
      '2026-03-03'::date + ((i - 1) * 7),
      1400,
      CASE WHEN i <= 3 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..3 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr, v_cl1, v_ase_c1, i, '2026-03-03'::date + ((i - 1) * 7),
      1400, 1400, TRUE, v_ase_c1,
      ('2026-03-03'::date + ((i - 1) * 7))::timestamptz + '09:00:00'
    );
  END LOOP;
END IF;

-- Cliente 2: semanal 8 semanas, 5 pagos (elegible)
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990002') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Cecilia','Navarro','Luna','1987-05-18',
    'FEMENINO','CASADO','7713990002','HGO-SW002','NALC870518MHFXXX02',
    'Privada Naranjos','22','La Providencia','Pachuca','Hidalgo','42002',
    'Cosméticos Ceci','Belleza','6 años',
    'Esposo Cecilia','7719000003','Conyuge','Prima Cecilia','7719000004','Prima',
    v_ase_c1, v_suc_cen
  ) RETURNING id INTO v_cl2;
ELSE
  SELECT id INTO v_cl2 FROM clientes WHERE celular = '7713990002';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-SEMANAL-8W-5P') THEN
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl2, v_ase_c1, v_suc_cen,
    9000, 9000, 9000,
    0.40, 3600, 12600, 1575,
    8, 'SEMANAL', 1575, 'NUEVO',
    'SEED-SEMANAL-8W-5P',
    '2026-02-10', '2026-04-21', '2026-02-10 09:15:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr;

  FOR i IN 1..8 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr,
      i,
      '2026-02-10'::date + ((i - 1) * 7),
      1575,
      CASE WHEN i <= 5 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..5 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr, v_cl2, v_ase_c1, i, '2026-02-10'::date + ((i - 1) * 7),
      1575, 1575, TRUE, v_ase_c1,
      ('2026-02-10'::date + ((i - 1) * 7))::timestamptz + '09:15:00'
    );
  END LOOP;
END IF;

-- Cliente 3: semanal 12 semanas, 6 pagos
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990003') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Miguel','Olvera','Campos','1984-08-02',
    'MASCULINO','CASADO','7713990003','HGO-SW003','OECM840802HHFXXX03',
    'Calle Reforma','8','San Javier','Pachuca','Hidalgo','42003',
    'Materiales Olvera','Construccion','9 años',
    'Esposa Miguel','7719000005','Conyuge','Hermano Miguel','7719000006','Hermano',
    v_ase_c2, v_suc_cen
  ) RETURNING id INTO v_cl3;
ELSE
  SELECT id INTO v_cl3 FROM clientes WHERE celular = '7713990003';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-SEMANAL-12W-6P') THEN
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl3, v_ase_c2, v_suc_cen,
    12000, 12000, 12000,
    0.40, 4800, 16800, 1400,
    12, 'SEMANAL', 1400, 'NUEVO',
    'SEED-SEMANAL-12W-6P',
    '2026-01-20', '2026-04-14', '2026-01-20 10:00:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr;

  FOR i IN 1..12 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr,
      i,
      '2026-01-20'::date + ((i - 1) * 7),
      1400,
      CASE WHEN i <= 6 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..6 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr, v_cl3, v_ase_c2, i, '2026-01-20'::date + ((i - 1) * 7),
      1400, 1400, TRUE, v_ase_c2,
      ('2026-01-20'::date + ((i - 1) * 7))::timestamptz + '10:00:00'
    );
  END LOOP;
END IF;

-- Cliente 4: semanal 12 semanas, 9 pagos (elegible)
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990004') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Rosa','Campos','Velazquez','1992-11-09',
    'FEMENINO','UNION_LIBRE','7713990004','HGO-SW004','CAVR921109MHFXXX04',
    'Av. Universidad','120','Periodistas','Pachuca','Hidalgo','42004',
    'Papeleria Rosa','Papeleria','5 años',
    'Madre Rosa','7719000007','Madre','Vecina Rosa','7719000008','Vecina',
    v_ase_c2, v_suc_cen
  ) RETURNING id INTO v_cl4;
ELSE
  SELECT id INTO v_cl4 FROM clientes WHERE celular = '7713990004';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-SEMANAL-12W-9P') THEN
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl4, v_ase_c2, v_suc_cen,
    24000, 24000, 24000,
    0.40, 9600, 33600, 2800,
    12, 'SEMANAL', 2800, 'NUEVO',
    'SEED-SEMANAL-12W-9P',
    '2025-12-16', '2026-03-10', '2025-12-16 09:40:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr;

  FOR i IN 1..12 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr,
      i,
      '2025-12-16'::date + ((i - 1) * 7),
      2800,
      CASE WHEN i <= 9 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..9 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr, v_cl4, v_ase_c2, i, '2025-12-16'::date + ((i - 1) * 7),
      2800, 2800, TRUE, v_ase_c2,
      ('2025-12-16'::date + ((i - 1) * 7))::timestamptz + '09:40:00'
    );
  END LOOP;
END IF;

-- Cliente 5: semanal 12 semanas, 10 pagos + multa semanal pendiente de $300
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990005') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Jorge','Santos','Mora','1981-04-04',
    'MASCULINO','CASADO','7713990005','HGO-SW005','SAMJ810404HHFXXX05',
    'Calle Mina','18','Centro','Pachuca','Hidalgo','42005',
    'Refacciones Jorge','Refacciones','10 años',
    'Esposa Jorge','7719000009','Conyuge','Socio Jorge','7719000010','Socio',
    v_ase_c1, v_suc_cen
  ) RETURNING id INTO v_cl5;
ELSE
  SELECT id INTO v_cl5 FROM clientes WHERE celular = '7713990005';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-SEMANAL-12W-10P-MULTA') THEN
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl5, v_ase_c1, v_suc_cen,
    30000, 30000, 30000,
    0.40, 12000, 42000, 3500,
    12, 'SEMANAL', 3500, 'NUEVO',
    'SEED-SEMANAL-12W-10P-MULTA',
    '2025-12-02', '2026-02-24', '2025-12-02 08:50:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr;

  FOR i IN 1..12 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr,
      i,
      '2025-12-02'::date + ((i - 1) * 7),
      3500,
      CASE WHEN i <= 10 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..10 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr, v_cl5, v_ase_c1, i, '2025-12-02'::date + ((i - 1) * 7),
      3500, 3500, TRUE, v_ase_c1,
      ('2025-12-02'::date + ((i - 1) * 7))::timestamptz + '08:50:00'
    );
  END LOOP;

  INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
  VALUES (v_cl5, v_cr, 'NO_PAGO', 300, '2026-02-10', FALSE);
END IF;

-- Cliente 6: renovación DIARIO -> SEMANAL (credito nuevo ACTIVO tipo RENOVACION)
IF NOT EXISTS (SELECT 1 FROM clientes WHERE celular = '7713990006') THEN
  INSERT INTO clientes (
    nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
    genero, estado_civil, celular, ine_numero, curp,
    dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
    negocio_nombre, negocio_giro, negocio_antiguedad,
    ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
    asesor_id, sucursal_id
  ) VALUES (
    'Adriana','Paredes','Lopez','1988-03-12',
    'FEMENINO','CASADO','7713990006','HGO-SW006','PALA880312MHFXXX06',
    'Calle Robles','31','San Antonio','Pachuca','Hidalgo','42006',
    'Miscelanea Adriana','Abarrotes','7 años',
    'Esposo Adriana','7719000011','Conyuge','Hermana Adriana','7719000012','Hermana',
    v_ase_c2, v_suc_cen
  ) RETURNING id INTO v_cl6;
ELSE
  SELECT id INTO v_cl6 FROM clientes WHERE celular = '7713990006';
END IF;

IF NOT EXISTS (SELECT 1 FROM creditos WHERE garantia_descripcion = 'SEED-RENOVACION-DIARIO-A-SEM') THEN
  -- Crédito anterior diario
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl6, v_ase_c2, v_suc_cen,
    10000, 10000, 10000,
    0.30, 3000, 13000, 520,
    25, 'DIARIO', 520, 'NUEVO',
    'SEED-RENOVACION-DIARIO-A-SEM-ANT',
    '2026-02-16', '2026-03-20', '2026-02-16 08:20:00-06', 'RENOVADO', v_admin
  ) RETURNING id INTO v_cr_ant;

  FOR i IN 1..25 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr_ant,
      i,
      '2026-02-16'::date + (i - 1),
      520,
      CASE WHEN i <= 20 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..20 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr_ant, v_cl6, v_ase_c2, i, '2026-02-16'::date + (i - 1),
      520, 520, TRUE, v_ase_c2,
      ('2026-02-16'::date + (i - 1))::timestamptz + '08:20:00'
    );
  END LOOP;

  -- Crédito nuevo semanal por renovación
  INSERT INTO creditos (
    cliente_id, asesor_id, sucursal_id,
    monto_solicitado, monto_capital, monto_aprobado,
    tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
    plazo_dias, tipo_pago, pago_adelantado, tipo,
    garantia_descripcion,
    fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by
  ) VALUES (
    v_cl6, v_ase_c2, v_suc_cen,
    12000, 12000, 12000,
    0.40, 4800, 16800, 1400,
    12, 'SEMANAL', 1400, 'RENOVACION',
    'SEED-RENOVACION-DIARIO-A-SEM',
    '2026-03-24', '2026-06-16', '2026-03-24 11:00:00-06', 'ACTIVO', v_admin
  ) RETURNING id INTO v_cr_nuevo;

  FOR i IN 1..12 LOOP
    INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
    VALUES (
      v_cr_nuevo,
      i,
      '2026-03-24'::date + ((i - 1) * 7),
      1400,
      CASE WHEN i <= 2 THEN 'PAGADO' ELSE 'PENDIENTE' END
    );
  END LOOP;

  FOR i IN 1..2 LOOP
    INSERT INTO pagos (
      credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
      monto_recibido, monto_esperado, es_completo, registrado_por, created_at
    ) VALUES (
      v_cr_nuevo, v_cl6, v_ase_c2, i, '2026-03-24'::date + ((i - 1) * 7),
      1400, 1400, TRUE, v_ase_c2,
      ('2026-03-24'::date + ((i - 1) * 7))::timestamptz + '11:00:00'
    );
  END LOOP;

  INSERT INTO renovaciones (
    credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
    fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
    monto_desembolso, monto_nuevo, monto_aprobado, tipo_pago,
    estado, aprobado_por, fecha_aprobacion, confirmado_por, fecha_confirmacion, created_by
  ) VALUES (
    v_cr_ant, v_cr_nuevo, v_cl6, v_ase_c2,
    '2026-03-24', 5, 2600, 0, 1400,
    8000, 12000, 12000, 'SEMANAL',
    'ACTIVO', v_admin, '2026-03-24 10:30:00-06', v_admin, '2026-03-24 11:00:00-06', v_admin
  );
END IF;

END $$;

-- ============================================================
-- AJUSTE AUTOMÁTICO DE FECHAS AL DÍA ACTUAL
-- Desplaza todas las fechas del seed para que siempre sean
-- relativas a CURRENT_DATE, sin importar cuándo se ejecuta.
-- Fecha de referencia: 2026-04-19 (fecha del último pago en el seed)
-- El shift lleva ese pago a CURRENT_DATE, dejando "Hoy" y "Ayer" con datos.
-- ============================================================
DO $$
DECLARE
  v_ref   DATE := '2026-04-19';
  v_shift INT  := CURRENT_DATE - v_ref;
BEGIN
  IF v_shift = 0 THEN
    RAISE NOTICE '✓ Sin desplazamiento de fechas (seed ya está al día)';
    RETURN;
  END IF;

  -- Pagos
  UPDATE pagos
  SET fecha_pago  = fecha_pago  + v_shift,
      created_at  = created_at  + (v_shift || ' days')::interval,
      updated_at  = updated_at  + (v_shift || ' days')::interval
  WHERE deleted_at IS NULL;

  -- Créditos
  UPDATE creditos
  SET fecha_inicio      = fecha_inicio      + v_shift,
      fecha_vencimiento = fecha_vencimiento + v_shift,
      fecha_desembolso  = fecha_desembolso  + (v_shift || ' days')::interval,
      created_at        = created_at        + (v_shift || ' days')::interval,
      updated_at        = updated_at        + (v_shift || ' days')::interval
  WHERE deleted_at IS NULL;

  -- Calendario de pagos (sin deleted_at)
  UPDATE calendario_pagos
  SET fecha_programada = fecha_programada + v_shift,
      updated_at       = updated_at       + (v_shift || ' days')::interval;

  -- Multas
  UPDATE multas
  SET fecha      = fecha      + v_shift,
      created_at = created_at + (v_shift || ' days')::interval,
      updated_at = updated_at + (v_shift || ' days')::interval
  WHERE deleted_at IS NULL;

  -- Renovaciones
  UPDATE renovaciones
  SET fecha             = fecha             + v_shift,
      fecha_aprobacion  = fecha_aprobacion  + (v_shift || ' days')::interval,
      fecha_confirmacion= fecha_confirmacion+ (v_shift || ' days')::interval,
      created_at        = created_at        + (v_shift || ' days')::interval,
      updated_at        = updated_at        + (v_shift || ' days')::interval
  WHERE deleted_at IS NULL;

  RAISE NOTICE '✓ Fechas desplazadas % días (referencia: % → hoy: %)', v_shift, v_ref, CURRENT_DATE;
END $$;
