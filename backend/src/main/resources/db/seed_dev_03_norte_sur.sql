-- ============================================================
-- PARTE 3: Clientes Norte (6) + Sur (5), Documentos, Índice
-- ============================================================

DO $$
DECLARE
  -- IDs de Parte 1
  v_suc_cen BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='suc_centro');
  v_suc_nor BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='suc_norte');
  v_suc_sur BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='suc_sur');
  v_admin   BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='admin');
  v_ase_c1  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c1');
  v_ase_c2  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c2');
  v_ase_c3  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c3');
  v_ase_n1  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_n1');
  v_ase_n2  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_n2');
  v_ase_s1  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_s1');
  v_ase_s2  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_s2');
  -- IDs de clientes Centro (para documentos)
  v_c18 BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='c18'); -- Hugo (coords+docs)
  v_c19 BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='c19'); -- Alejandra (docs)
  v_c7  BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='c7');  -- Isabel (docs)

  -- Clientes Norte
  v_n1 BIGINT; -- Beatriz Núñez — ACTIVO pago 5
  v_n2 BIGINT; -- Ernesto Silva — ACTIVO pago 17, elegible
  v_n3 BIGINT; -- Gloria Pacheco — renovación APROBADO
  v_n4 BIGINT; -- Héctor Reyes — ACTIVO pago 3
  v_n5 BIGINT; -- Irma Vargas — PAGADO
  v_n6 BIGINT; -- Julián Torres — ACTIVO pagos incompletos

  -- Clientes Sur
  v_s1 BIGINT; -- Karina Medina — ACTIVO pago 7
  v_s2 BIGINT; -- Luis Gómez — ACTIVO multas pago 8
  v_s3 BIGINT; -- Marcela Ruiz — $25,000 30d pago 20, elegible
  v_s4 BIGINT; -- Norberto Peña — PAGADO
  v_s5 BIGINT; -- Olivia Castro — renovación APROBADO Norte→Sur

  v_ca BIGINT; v_cn BIGINT;
  i INT;
BEGIN

-- ════════════════════════════════════════════════════════════════
-- A. CLIENTES NORTE
-- ════════════════════════════════════════════════════════════════

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Beatriz','Núñez','Solis','1983-07-22','FEMENINO','CASADO','7714001001',
   'HGO-N001','NUSB830722MHFXXX01',
   'Calle Industria','18','Col. Industrial','Pachuca','Hidalgo','42100',
   'Mercería Beatriz','Mercería','5 años',
   'Esposo Núñez','7710002001','Cónyuge','Hermana Núñez','7710002002','Hermana',
   v_ase_n1, v_suc_nor)
RETURNING id INTO v_n1;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Ernesto','Silva','Fuentes','1979-11-08','MASCULINO','CASADO','7714001002',
   'HGO-N002','SIFE791108HHFXXX02',
   'Av. Central Norte','65','Col. Progreso','Pachuca','Hidalgo','42101',
   'Electrónica Silva','Electrónica','8 años',
   'Esposa Silva','7710002003','Cónyuge','Socio Silva','7710002004','Socio',
   v_ase_n1, v_suc_nor)
RETURNING id INTO v_n2;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Gloria','Pacheco','Ramos','1986-03-14','FEMENINO','UNION_LIBRE','7714001003',
   'HGO-N003','PARG860314MHFXXX03',
   'Calle Los Pinos','4','Col. Los Pinos','Pachuca','Hidalgo','42102',
   'Tortillería y Molino Gloria','Alimentos','6 años',
   'Madre Pacheco','7710002005','Madre','Vecina Pacheco','7710002006','Vecina',
   v_ase_n1, v_suc_nor)
RETURNING id INTO v_n3;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Héctor','Reyes','Quiroz','1994-09-25','MASCULINO','SOLTERO','7714001004',
   'HGO-N004','REQH940925HHFXXX04',
   'Priv. Las Flores','2','Col. Jardines Norte','Pachuca','Hidalgo','42103',
   'Zapatería Reyes','Calzado','2 años',
   'Madre Reyes','7710002007','Madre','Padre Reyes','7710002008','Padre',
   v_ase_n2, v_suc_nor)
RETURNING id INTO v_n4;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Irma','Vargas','Medrano','1981-05-30','FEMENINO','CASADO','7714001005',
   'HGO-N005','VAMI810530MHFXXX05',
   'Calle Olivos','33','Col. Los Olivos','Pachuca','Hidalgo','42104',
   'Estética Irma','Belleza','7 años',
   'Esposo Vargas','7710002009','Cónyuge','Hermana Vargas','7710002010','Hermana',
   v_ase_n2, v_suc_nor)
RETURNING id INTO v_n5;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Julián','Torres','Espinosa','1988-12-17','MASCULINO','CASADO','7714001006',
   'HGO-N006','TOEJ881217HHFXXX06',
   'Calle Nogales','11','Col. Las Huertas Norte','Pachuca','Hidalgo','42105',
   'Tienda de Materiales Torres','Construcción','4 años',
   'Esposa Torres','7710002011','Cónyuge','Cuñado Torres','7710002012','Cuñado',
   v_ase_n1, v_suc_nor)
RETURNING id INTO v_n6;

-- ════════════════════════════════════════════════════════════════
-- B. CRÉDITOS NORTE
-- ════════════════════════════════════════════════════════════════

-- BEATRIZ NÚÑEZ: $10,000 25d 30%, pago 5
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n1, v_ase_n1, v_suc_nor, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-04-13','2026-05-11','2026-04-13 08:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-13'::date + (i-1), 520,
    CASE WHEN i <= 5 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..5 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_n1, v_ase_n1, i, '2026-04-13'::date+(i-1), 520,520,TRUE,v_ase_n1,
    ('2026-04-13'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

-- ERNESTO SILVA: $15,000 25d 24%, pago 17, elegible
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n2, v_ase_n1, v_suc_nor, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO',
  '2026-03-16','2026-04-14','2026-03-16 08:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-03-16'::date + (i-1), 744,
    CASE WHEN i <= 17 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..17 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_n2, v_ase_n1, i, '2026-03-16'::date+(i-1), 744,744,TRUE,v_ase_n1,
    ('2026-03-16'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

-- GLORIA PACHECO: $12,000 → $14,000 renovación APROBADO (Lun 6 abr)
-- Anterior: pago=624, 2 restantes. Nuevo: pago=728
-- Desembolso: 14000-1248-0-728 = 12024
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n3, v_ase_n1, v_suc_nor, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO',
  '2026-03-05','2026-04-03','2026-03-05 09:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-05'::date + (i-1), 624, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n3, v_ase_n1, v_suc_nor, 14000,14000,14000, 0.30,4200,18200,728,
  25,'DIARIO',728,'RENOVACION',
  '2026-04-06','2026-05-04','2026-04-06 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-06'::date + (i-1), 728,
    CASE WHEN i <= 11 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..11 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_n3, v_ase_n1, i, '2026-04-06'::date+(i-1), 728,728,TRUE,v_ase_n1,
    ('2026-04-06'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, monto_aprobado, tipo_pago, estado, aprobado_por, fecha_aprobacion, created_by)
VALUES (v_ca, v_cn, v_n3, v_ase_n1, '2026-04-06', 2,1248, 0,728,
  12024, 14000, 14000,'DIARIO','ACTIVO',v_admin,'2026-04-06 09:30:00-06',v_admin);

-- HÉCTOR REYES: $8,000 25d 30%, pago 3
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n4, v_ase_n2, v_suc_nor, 8000,8000,8000, 0.30,2400,10400,416,
  25,'DIARIO',416,'NUEVO',
  '2026-04-15','2026-05-13','2026-04-15 08:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-15'::date + (i-1), 416,
    CASE WHEN i <= 3 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..3 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_n4, v_ase_n2, i, '2026-04-15'::date+(i-1), 416,416,TRUE,v_ase_n2,
    ('2026-04-15'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

-- IRMA VARGAS: $10,000 25d 30%, PAGADO
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n5, v_ase_n2, v_suc_nor, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-02-02','2026-03-02','2026-02-02 08:00:00-06','PAGADO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-02-02'::date + (i-1), 520, 'PAGADO');
END LOOP;

-- JULIÁN TORRES: $12,000 25d 30%, pago 10 con pagos PARCIAL (días 4,8)
-- Multa INCOMPLETO por 2 parciales acumulados
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_n6, v_ase_n1, v_suc_nor, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO',
  '2026-04-07','2026-05-05','2026-04-07 09:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-07'::date + (i-1), 624,
    CASE
      WHEN i IN (4,8) THEN 'PARCIAL'
      WHEN i <= 10    THEN 'PAGADO'
      ELSE 'PENDIENTE'
    END);
END LOOP;

FOR i IN 1..10 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_n6, v_ase_n1, i, '2026-04-07'::date+(i-1),
    CASE WHEN i IN (4,8) THEN 450 ELSE 624 END,
    624,
    CASE WHEN i IN (4,8) THEN FALSE ELSE TRUE END,
    v_ase_n1,
    ('2026-04-07'::date+(i-1))::timestamptz+'09:30:00');
END LOOP;

INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES (v_n6, v_cn, 'INCOMPLETO', 50, '2026-04-11', FALSE);

-- ════════════════════════════════════════════════════════════════
-- C. CLIENTES SUR
-- ════════════════════════════════════════════════════════════════

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Karina','Medina','Ruiz','1990-08-14','FEMENINO','CASADO','7715001001',
   'HGO-S001','MERK900814MHFXXX01',
   'Calle Constitución','22','Col. Centro','Mineral de la Reforma','Hidalgo','42180',
   'Dulcería y Piñatería Karina','Dulces','3 años',
   'Esposo Medina','7710003001','Cónyuge','Madre Medina','7710003002','Madre',
   v_ase_s1, v_suc_sur)
RETURNING id INTO v_s1;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Luis','Gómez','Varela','1984-04-02','MASCULINO','UNION_LIBRE','7715001002',
   'HGO-S002','GOVL840402HHFXXX02',
   'Av. Reforma Sur','45','Col. Morelos','Mineral de la Reforma','Hidalgo','42181',
   'Tlapalería Gómez','Ferretería','9 años',
   'Pareja Gómez','7710003003','Pareja','Hermano Gómez','7710003004','Hermano',
   v_ase_s1, v_suc_sur)
RETURNING id INTO v_s2;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Marcela','Ruiz','Sánchez','1978-01-28','FEMENINO','CASADO','7715001003',
   'HGO-S003','RUSM780128MHFXXX03',
   'Blvd. Independencia Sur','78','Col. La Providencia Sur','Mineral de la Reforma','Hidalgo','42182',
   'Boutique Marcela Modas','Ropa','6 años',
   'Esposo Ruiz','7710003005','Cónyuge','Hermana Ruiz','7710003006','Hermana',
   v_ase_s2, v_suc_sur)
RETURNING id INTO v_s3;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Norberto','Peña','Contreras','1982-10-11','MASCULINO','CASADO','7715001004',
   'HGO-S004','PECN821011HHFXXX04',
   'Calle Libertad','16','Col. Libertad','Mineral de la Reforma','Hidalgo','42183',
   'Abarrotes y Ultramarinos Peña','Abarrotes','10 años',
   'Esposa Peña','7710003007','Cónyuge','Hijo Peña','7710003008','Hijo',
   v_ase_s2, v_suc_sur)
RETURNING id INTO v_s4;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Olivia','Castro','Mendoza','1991-06-05','FEMENINO','SOLTERO','7715001005',
   'HGO-S005','CAMO910605MHFXXX05',
   'Privada Girasoles','3','Col. Los Girasoles','Mineral de la Reforma','Hidalgo','42184',
   'Costura y Diseño Olivia','Ropa','4 años',
   'Madre Castro','7710003009','Madre','Hermana Castro','7710003010','Hermana',
   v_ase_s1, v_suc_sur)
RETURNING id INTO v_s5;

-- ════════════════════════════════════════════════════════════════
-- D. CRÉDITOS SUR
-- ════════════════════════════════════════════════════════════════

-- KARINA MEDINA: $10,000 25d 30%, pago 7
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s1, v_ase_s1, v_suc_sur, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-04-10','2026-05-08','2026-04-10 09:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-10'::date + (i-1), 520,
    CASE WHEN i <= 7 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..7 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_s1, v_ase_s1, i, '2026-04-10'::date+(i-1), 520,520,TRUE,v_ase_s1,
    ('2026-04-10'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

-- LUIS GÓMEZ: $12,000 25d 30%, pago 8, dos no-pagos → multas $100
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s2, v_ase_s1, v_suc_sur, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO',
  '2026-04-08','2026-05-06','2026-04-08 08:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-08'::date + (i-1), 624,
    CASE
      WHEN i IN (3,6)  THEN 'NO_PAGADO'
      WHEN i <= 8       THEN 'PAGADO'
      ELSE 'PENDIENTE'
    END);
END LOOP;

FOR i IN 1..8 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, razon_no_pago, multa_aplicada,
    registrado_por, created_at)
  VALUES (v_cn, v_s2, v_ase_s1, i, '2026-04-08'::date+(i-1),
    CASE WHEN i IN (3,6) THEN 0 ELSE 624 END,
    624,
    CASE WHEN i IN (3,6) THEN FALSE ELSE TRUE END,
    CASE WHEN i IN (3,6) THEN 'No encontramos a nadie en el negocio' ELSE NULL END,
    CASE WHEN i IN (3,6) THEN 50 ELSE 0 END,
    v_ase_s1,
    ('2026-04-08'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES
  (v_s2, v_cn, 'NO_PAGO', 50, '2026-04-10', FALSE),
  (v_s2, v_cn, 'NO_PAGO', 50, '2026-04-13', FALSE);

-- MARCELA RUIZ: $25,000 30d 24%, pago 20, elegible (umbral=19)
-- cargo=6000, total=31000, pago=1033.33
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s3, v_ase_s2, v_suc_sur, 25000,25000,25000, 0.24,6000,31000,1033.33,
  30,'DIARIO',1033.33,'NUEVO',
  '2026-03-12','2026-04-15','2026-03-12 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-03-12'::date + (i-1), 1033.33,
    CASE WHEN i <= 20 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..20 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_s3, v_ase_s2, i, '2026-03-12'::date+(i-1), 1033.33,1033.33,TRUE,v_ase_s2,
    ('2026-03-12'::date+(i-1))::timestamptz+'10:00:00');
END LOOP;

-- NORBERTO PEÑA: $8,000 25d 30%, PAGADO
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s4, v_ase_s2, v_suc_sur, 8000,8000,8000, 0.30,2400,10400,416,
  25,'DIARIO',416,'NUEVO',
  '2026-02-10','2026-03-10','2026-02-10 08:00:00-06','PAGADO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-02-10'::date + (i-1), 416, 'PAGADO');
END LOOP;

-- OLIVIA CASTRO: $10,000 → $12,000 renovación APROBADO Sur (Jue 9 abr)
-- Anterior: pago=520, 2 restantes. Nuevo: pago=624
-- Desembolso: 12000-1040-0-624 = 10336
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s5, v_ase_s1, v_suc_sur, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-03-06','2026-04-04','2026-03-06 09:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-06'::date + (i-1), 520, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_s5, v_ase_s1, v_suc_sur, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'RENOVACION',
  '2026-04-09','2026-05-07','2026-04-09 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-09'::date + (i-1), 624,
    CASE WHEN i <= 8 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..8 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_s5, v_ase_s1, i, '2026-04-09'::date+(i-1), 624,624,TRUE,v_ase_s1,
    ('2026-04-09'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, monto_aprobado, tipo_pago, estado, aprobado_por, fecha_aprobacion, created_by)
VALUES (v_ca, v_cn, v_s5, v_ase_s1, '2026-04-09', 2,1040, 0,624,
  10336, 12000, 12000,'DIARIO','ACTIVO',v_admin,'2026-04-09 09:45:00-06',v_admin);

-- ════════════════════════════════════════════════════════════════
-- E. DOCUMENTOS DE CLIENTES (cliente_documentos)
-- URLs de placeholder simulando S3
-- ════════════════════════════════════════════════════════════════

-- Hugo Morales (v_c18) — INE frente + INE reverso
INSERT INTO cliente_documentos (cliente_id, tipo, url, nombre, created_by) VALUES
  (v_c18, 'INE_FRENTE',   'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c18_ine_frente.jpg',   'INE Frente Hugo Morales',   v_ase_c3),
  (v_c18, 'INE_REVERSO',  'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c18_ine_reverso.jpg', 'INE Reverso Hugo Morales',  v_ase_c3);

-- Alejandra López (v_c19) — INE frente + comprobante domicilio
INSERT INTO cliente_documentos (cliente_id, tipo, url, nombre, created_by) VALUES
  (v_c19, 'INE_FRENTE',            'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c19_ine_frente.jpg',      'INE Frente Alejandra López', v_ase_c3),
  (v_c19, 'COMPROBANTE_DOMICILIO', 'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c19_comprobante.pdf',     'CFE Abril 2026',             v_ase_c3);

-- Isabel Cruz (v_c7) — INE frente + INE reverso + comprobante
INSERT INTO cliente_documentos (cliente_id, tipo, url, nombre, created_by) VALUES
  (v_c7, 'INE_FRENTE',            'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c7_ine_frente.jpg',       'INE Frente Isabel Cruz', v_ase_c1),
  (v_c7, 'INE_REVERSO',           'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c7_ine_reverso.jpg',      'INE Reverso Isabel Cruz',v_ase_c1),
  (v_c7, 'COMPROBANTE_DOMICILIO', 'https://magno-dev.s3.mx-central-1.amazonaws.com/clientes/docs/c7_comprobante.pdf',      'Agua Feb 2026',          v_ase_c1);

RAISE NOTICE '✓ Parte 3 completada: 11 clientes Norte/Sur, créditos, renovaciones, pagos, multas, documentos';

END $$;

-- ════════════════════════════════════════════════════════════════
-- ÍNDICE DE CASOS DE PRUEBA
-- Busca el cliente/crédito por id en la BD después de ejecutar.
-- ════════════════════════════════════════════════════════════════

/*
  ╔══════════════════════════════════════════════════════════════════╗
  ║  ÍNDICE DE CASOS DE PRUEBA — MAGNO Seed v2.0                    ║
  ╠══════════════════════════════════════════════════════════════════╣

  CADENAS DE RENOVACIONES
  ─────────────────────────────────────────────────────────────────
  CASO: Cadena de 3 renovaciones encadenadas
        Cliente: Elena Vega (Centro, asesor=carlos@magno.mx)
        Cr.1 RENOVADO ($10k) → Cr.2 RENOVADO ($12k) → Cr.3 ACTIVO pago 17
        Navegación: CreditoDetallePage muestra bloques Liquidado/Originado
        Query: SELECT * FROM renovaciones WHERE cliente_id=(SELECT id FROM clientes WHERE nombre='Elena' AND apellido_paterno='Vega');

  RENOVACIONES APROBADAS (semana actual: 14-18 abr 2026)
  ─────────────────────────────────────────────────────────────────
  CASO: Renovación APROBADO $15k→$17k (Lun 14 abr)
        Cliente: María García | Desembolso: $13,924.80

  CASO: Renovación APROBADO $10k→$12k (Lun 14 abr)
        Cliente: José Martínez | Desembolso: $10,336.00

  CASO: Renovación APROBADO 30d $20k→$22k (Mié 15 abr)
        Cliente: Ana López | Desembolso: $17,783.99

  CASO: Renovación APROBADO con multa $100 (Jue 16 abr)
        Cliente: Pedro Ramírez | Desembolso: $13,412.00

  CASO: Renovación APROBADO $12k→$14k (Vie 18 abr)
        Cliente: Lucía Torres | Desembolso: $12,024.00

  RENOVACIONES APROBADAS (semana anterior: 6-10 abr 2026)
  ─────────────────────────────────────────────────────────────────
  CASO: Renovación APROBADO Norte $12k→$14k (Lun 6 abr)
        Cliente: Gloria Pacheco | Sucursal Norte

  CASO: Renovación APROBADO Sur $10k→$12k (Jue 9 abr)
        Cliente: Olivia Castro | Sucursal Sur

  CASO: Renovación APROBADO $15k→$17k (Lun 6 abr)
        Cliente: David Hernández | Nuevo en pago 11

  SOLICITUDES PENDIENTES (estado = SOLICITADO)
  ─────────────────────────────────────────────────────────────────
  CASO: SOLICITADO por Asesor (carlos@magno.mx)
        Cliente: Isabel Cruz | Pago 20/25 | Solicita $18k | Desembolso: $13,387.20
        Query: SELECT * FROM renovaciones WHERE estado='SOLICITADO' AND asesor_id=(SELECT id FROM usuarios WHERE email='carlos@magno.mx');

  CASO: SOLICITADO por Supervisor (supervisor.centro@magno.mx)
        Cliente: Ramón Castillo | Pago 22/30 ($20k) | Solicita $25k | Multas: $100 | Desembolso: $17,253.31
        Aparece en pestaña "Pendientes de Aprobación" para gerentes.

  CASO: SOLICITADO casi-cero desembolso (edge case extremo)
        Cliente: Verónica Reyes | $6k, 4 no-pagos, multas=$200 | Solicita $3k | Desembolso: $148
        Verifica que el cálculo muestra monto muy bajo en la tarjeta.

  RENOVACIÓN RECHAZADA
  ─────────────────────────────────────────────────────────────────
  CASO: RECHAZADO con motivo (gerente.centro@magno.mx rechazó)
        Cliente: Tomás Luna | Crédito ACTIVO en pago 18 | Motivo: "Monto solicitado supera historial..."
        Query: SELECT motivo_rechazo FROM renovaciones WHERE estado='RECHAZADO';

  LISTOS PARA RENOVAR (sin solicitud pendiente)
  ─────────────────────────────────────────────────────────────────
  CASO: Listo para renovar 25d (umbral=16 pagos)
        Cliente: Elena Vega — crédito 3, pago 17 ✓
        Cliente: Ernesto Silva Norte — pago 17 ✓

  CASO: Listo para renovar 30d (umbral=19 pagos)
        Cliente: Patricia Castillo — $25k, pago 20 ✓
        Cliente: Marcela Ruiz Sur — $25k, pago 20 ✓

  CASO: Listo para renovar CON MULTAS (desembolso reducido automáticamente)
        Cliente: Daniela Medina | $10k pago 18 | Multas pendientes: $100
        Al crear solicitud → el cálculo descuenta $100 del desembolso.

  CRÉDITOS EN ESTADOS VARIADOS
  ─────────────────────────────────────────────────────────────────
  CASO: Crédito ACTIVO temprano pago 3-8 (no elegibles)
        Centro: Roberto Flores (pago 5), Sofía Herrera (pago 4)
        Norte:  Beatriz Núñez (pago 5), Héctor Reyes (pago 3)
        Sur:    Karina Medina (pago 7)

  CASO: Crédito $30,000 30d (monto grande)
        Cliente: Fernando Salinas | Pago 6/30 | Garantía: camioneta de reparto

  CASO: Crédito PAGADO
        Centro: Carlos Cruz ($8k, ene-feb 2026)
        Norte:  Irma Vargas ($10k, feb-mar 2026)
        Sur:    Norberto Peña ($8k, feb-mar 2026)

  CASO: Crédito CANCELADO
        Cliente: Rocío Morales | Cancelado en pago 5

  PAGOS ESPECIALES
  ─────────────────────────────────────────────────────────────────
  CASO: Pagos NO_PAGADO + multas generadas
        Daniela Medina: días 7 y 14 → multas NO_PAGO $50 c/u (Centro)
        Verónica Reyes: días 5,9,13,16 → multas NO_PAGO $50 c/u (Centro)
        Luis Gómez: días 3 y 6 → multas NO_PAGO $50 c/u (Sur)
        Ramón Castillo: día 15 → multa NO_PAGO $100 (crédito ≥$15k)

  CASO: Pagos PARCIAL (incompletos) + multa INCOMPLETO
        Alejandra López: días 3 y 6 → $400 de $624 → multa INCOMPLETO $50 (Centro)
        Julián Torres Norte: días 4 y 8 → $450 de $624 → multa INCOMPLETO $50 (Norte)

  DOCUMENTOS DE CLIENTES
  ─────────────────────────────────────────────────────────────────
  CASO: Tres documentos (INE frente + reverso + comprobante)
        Cliente: Isabel Cruz — tab Documentos en ficha de cliente

  CASO: Dos documentos (INE frente + reverso)
        Cliente: Hugo Morales — también tiene coordenadas de negocio

  CASO: Dos documentos (INE frente + comprobante)
        Cliente: Alejandra López

  COORDENADAS DE NEGOCIO
  ─────────────────────────────────────────────────────────────────
  CASO: Negocio con pin en mapa
        Verónica Reyes: lat=20.1177, lng=-98.7305
        Hugo Morales:   lat=20.1234, lng=-98.7412

  FILTROS POR ASESOR/SUCURSAL
  ─────────────────────────────────────────────────────────────────
  CASO: Asesor con clientes en TODOS los estados
        carlos@magno.mx → Elena Vega (cadena), María García (ACTIVO renovado),
        Isabel Cruz (SOLICITADO), Sofía Herrera (ACTIVO temprano),
        Patricia Castillo (ACTIVO eligible), Carlos Cruz (PAGADO), Tomás Luna (RECHAZADO+ACTIVO)

  COLOCACIONES SEMANALES
  ─────────────────────────────────────────────────────────────────
  Semana 14-18 abr 2026: 5 renovaciones (v_c2..v_c6) + consultar por fecha
  Semana  6-10 abr 2026: Gloria Pacheco Norte + David Hernández Centro
  Semana  9 abr:         Olivia Castro Sur

  LOGINS DE PRUEBA (contraseña: password123)
  ─────────────────────────────────────────────────────────────────
  admin@magno.mx              — Gerente General (ve todo, todas las sucursales)
  gerente.centro@magno.mx     — Gerente Sucursal Centro (aprueba/rechaza renovaciones)
  supervisor.centro@magno.mx  — Supervisor Centro (puede crear solicitudes)
  carlos@magno.mx             — Asesor Centro 1 (tiene clientes en todos los estados)
  laura@magno.mx              — Asesor Centro 2
  diego@magno.mx              — Asesor Centro 3
  gerente.norte@magno.mx      — Gerente Sucursal Norte
  gerente.sur@magno.mx        — Gerente Sucursal Sur
  ╚══════════════════════════════════════════════════════════════════╝
*/

DO $$
BEGIN
  RAISE NOTICE '✓ Seed completo: % sucursales, % usuarios, % clientes, % créditos, % renovaciones',
    (SELECT count(*) FROM sucursales WHERE nombre IN ('Centro','Norte','Sur')),
    (SELECT count(*) FROM usuarios WHERE email LIKE '%@magno.mx'),
    (SELECT count(*) FROM clientes WHERE sucursal_id IN (SELECT val FROM magno_seed_ids WHERE clave LIKE 'suc_%')),
    (SELECT count(*) FROM creditos WHERE sucursal_id IN (SELECT val FROM magno_seed_ids WHERE clave LIKE 'suc_%')),
    (SELECT count(*) FROM renovaciones);
END $$;
