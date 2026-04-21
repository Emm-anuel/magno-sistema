-- ============================================================
-- PARTE 2: Clientes y Créditos — Sucursal CENTRO (20 clientes)
--
-- Tasas de referencia:
--   < $15,000  → 25 días, 30%  (cargo = capital * 0.30)
--   $15k–$19k  → 25 días, 24%
--   ≥ $20,000  → 30 días, 24%
--   pago_diario = (capital + cargo) / plazo
-- ============================================================

DO $$
DECLARE
  -- IDs de Parte 1
  v_suc   BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='suc_centro');
  v_admin BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='admin');
  v_ase_c1 BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c1'); -- Carlos
  v_ase_c2 BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c2'); -- Laura
  v_ase_c3 BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='ase_c3'); -- Diego
  v_sup_cen BIGINT := (SELECT val FROM magno_seed_ids WHERE clave='sup_cen');

  -- Clientes
  v_c1  BIGINT; -- Elena Vega — cadena 3 renovaciones
  v_c2  BIGINT; -- María García — renovación semana actual APROBADO
  v_c3  BIGINT; -- José Martínez — renovación semana actual APROBADO
  v_c4  BIGINT; -- Ana López — renovación 30d APROBADO
  v_c5  BIGINT; -- Pedro Ramírez — renovación con multa APROBADO
  v_c6  BIGINT; -- Lucía Torres — renovación semana actual APROBADO
  v_c7  BIGINT; -- Isabel Cruz — SOLICITADO por asesor (carlos)
  v_c8  BIGINT; -- Ramón Castillo — SOLICITADO por supervisor_campo
  v_c9  BIGINT; -- Tomás Luna — RECHAZADO con motivo
  v_c10 BIGINT; -- Daniela Medina — ACTIVO multas, pago 18, listo renovar
  v_c11 BIGINT; -- Roberto Flores — ACTIVO pago 5, temprano
  v_c12 BIGINT; -- Sofía Herrera — ACTIVO pago 4, temprano
  v_c13 BIGINT; -- Fernando Salinas — ACTIVO $30,000 30d pago 6
  v_c14 BIGINT; -- Patricia Castillo — ACTIVO $25,000 30d pago 20, listo renovar
  v_c15 BIGINT; -- Carlos Cruz — PAGADO (historial limpio)
  v_c16 BIGINT; -- Rocío Morales — CANCELADO
  v_c17 BIGINT; -- Verónica Reyes — SOLICITADO casi-cero desembolso + coords
  v_c18 BIGINT; -- Hugo Morales — ACTIVO pago 7 + coords + docs
  v_c19 BIGINT; -- Alejandra López — ACTIVO pago 8 + docs
  v_c20 BIGINT; -- David Hernández — semana anterior APROBADO

  -- Créditos (reutilizamos v_ca=anterior, v_cn=nuevo)
  v_ca BIGINT; v_cn BIGINT;
  -- Cadena Elena: necesitamos 3 IDs simultáneos
  v_elena_cr1 BIGINT; v_elena_cr2 BIGINT; v_elena_cr3 BIGINT;
  -- SOLICITADO (solo crédito anterior, sin nuevo)
  v_sol_isabel BIGINT;
  v_sol_ramon  BIGINT;
  v_sol_vero   BIGINT;
  -- RECHAZADO
  v_rec_tomas  BIGINT;
  v_ren_aprobada BIGINT; -- Renovación APROBADO pendiente desembolso (Patricia)
  -- Multa temp
  v_cal_id BIGINT;
  i INT;
BEGIN

-- ════════════════════════════════════════════════════════════════
-- A. CLIENTES CENTRO
-- ════════════════════════════════════════════════════════════════

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Elena','Vega','Ríos','1980-04-10','FEMENINO','CASADO','7713001001',
   'HGO-C001','VERE800410MHFXXX01',
   'Calle Guerrero','12','Col. Obrera','Pachuca','Hidalgo','42001',
   'Abarrotes Doña Elena','Abarrotes','8 años',
   'Hijo Vega','7710001001','Hijo','Vecina Vega','7710001002','Vecina',
   v_ase_c1, v_suc)
RETURNING id INTO v_c1;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('María','García','Pérez','1985-03-15','FEMENINO','CASADO','7713001002',
   'HGO-C002','GAPE850315MHFXXX02',
   'Calle Hidalgo','10','Col. Centro','Pachuca','Hidalgo','42002',
   'Tortillería La Paloma','Alimentos','4 años',
   'Hermana García','7710001003','Hermana','Prima García','7710001004','Prima',
   v_ase_c1, v_suc)
RETURNING id INTO v_c2;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('José','Martínez','Flores','1978-07-20','MASCULINO','CASADO','7713001003',
   'HGO-C003','MAFJ780720HHFXXX03',
   'Calle Reforma','20','Col. Morelos','Pachuca','Hidalgo','42003',
   'Taller Mecánico JM','Servicios automotrices','6 años',
   'Esposa Martínez','7710001005','Cónyuge','Amigo Martínez','7710001006','Amigo',
   v_ase_c2, v_suc)
RETURNING id INTO v_c3;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Ana','López','Cruz','1990-11-05','FEMENINO','SOLTERO','7713001004',
   'HGO-C004','LOCA901105MHFXXX04',
   'Blvd. Independencia','35','Col. La Providencia','Pachuca','Hidalgo','42004',
   'Estética Beauty Ana','Belleza','3 años',
   'Madre López','7710001007','Madre','Vecina López','7710001008','Vecina',
   v_ase_c1, v_suc)
RETURNING id INTO v_c4;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Pedro','Ramírez','González','1982-05-28','MASCULINO','UNION_LIBRE','7713001005',
   'HGO-C005','RAGP820528HHFXXX05',
   'Calle Allende','8','Col. San Juan','Pachuca','Hidalgo','42005',
   'Carnicería Don Pedro','Carnes','7 años',
   'Pareja Ramírez','7710001009','Pareja','Hermano Ramírez','7710001010','Hermano',
   v_ase_c2, v_suc)
RETURNING id INTO v_c5;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Lucía','Torres','Morales','1993-09-12','FEMENINO','CASADO','7713001006',
   'HGO-C006','TOML930912MHFXXX06',
   'Calle Zaragoza','55','Col. Las Flores','Pachuca','Hidalgo','42006',
   'Cocina Económica Lucía','Restaurante','2 años',
   'Esposo Torres','7710001011','Cónyuge','Cuñada Torres','7710001012','Cuñada',
   v_ase_c1, v_suc)
RETURNING id INTO v_c6;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Isabel','Cruz','Jiménez','1986-10-08','FEMENINO','CASADO','7713001007',
   'HGO-C007','CUJI861008MHFXXX07',
   'Calle Robles','5','Col. El Roble','Pachuca','Hidalgo','42007',
   'Fondita Doña Isabel','Restaurante','6 años',
   'Esposo Cruz','7710001013','Cónyuge','Hermano Cruz','7710001014','Hermano',
   v_ase_c1, v_suc)
RETURNING id INTO v_c7;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Ramón','Castillo','Vargas','1979-06-14','MASCULINO','CASADO','7713001008',
   'HGO-C008','CAVR790614HHFXXX08',
   'Callejón Cedros','9','Col. Cedros','Pachuca','Hidalgo','42008',
   'Zapatería Castillo','Calzado','9 años',
   'Esposa Castillo','7710001015','Cónyuge','Hijo Castillo','7710001016','Hijo',
   v_ase_c2, v_suc)
RETURNING id INTO v_c8;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Tomás','Luna','Espinoza','1983-01-17','MASCULINO','SOLTERO','7713001009',
   'HGO-C009','LUET830117HHFXXX09',
   'Calle Tulipanes','30','Col. Las Palmas','Pachuca','Hidalgo','42009',
   'Vulcanizadora Luna','Automotriz','4 años',
   'Madre Luna','7710001017','Madre','Hermana Luna','7710001018','Hermana',
   v_ase_c1, v_suc)
RETURNING id INTO v_c9;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Daniela','Medina','Rojas','1991-03-22','FEMENINO','CASADO','7713001010',
   'HGO-C010','MERD910322MHFXXX10',
   'Calle Pinos','16','Col. Los Pinos','Pachuca','Hidalgo','42010',
   'Frutería y Verduras Dani','Verduras','2 años',
   'Esposo Medina','7710001019','Cónyuge','Madre Medina','7710001020','Madre',
   v_ase_c2, v_suc)
RETURNING id INTO v_c10;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Roberto','Flores','Díaz','1988-02-14','MASCULINO','SOLTERO','7713001011',
   'HGO-C011','FODR880214HHFXXX11',
   'Calle Morelos','3','Col. Cuauhtémoc','Pachuca','Hidalgo','42011',
   'Ferretería Flores','Ferretería','5 años',
   'Madre Flores','7710001021','Madre','Hermano Flores','7710001022','Hermano',
   v_ase_c2, v_suc)
RETURNING id INTO v_c11;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Sofía','Herrera','Vargas','1995-06-30','FEMENINO','SOLTERO','7713001012',
   'HGO-C012','HEVS950630MHFXXX12',
   'Privada del Sol','7','Col. El Arbolillo','Pachuca','Hidalgo','42012',
   'Papelería y Librería Sofía','Papelería','2 años',
   'Madre Herrera','7710001023','Madre','Padre Herrera','7710001024','Padre',
   v_ase_c1, v_suc)
RETURNING id INTO v_c12;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Fernando','Salinas','Castro','1976-08-03','MASCULINO','CASADO','7713001013',
   'HGO-C013','SACF760803HHFXXX13',
   'Av. Las Torres','200','Col. Torres','Pachuca','Hidalgo','42013',
   'Maderas y Materiales Salinas','Materiales construcción','11 años',
   'Esposa Salinas','7710001025','Cónyuge','Socio Salinas','7710001026','Socio',
   v_ase_c2, v_suc)
RETURNING id INTO v_c13;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Patricia','Castillo','Mendez','1981-12-20','FEMENINO','CASADO','7713001014',
   'HGO-C014','CAMP811220MHFXXX14',
   'Calle Arcos','14','Col. Los Arcos','Pachuca','Hidalgo','42014',
   'Boutique Patricia','Ropa y accesorios','5 años',
   'Esposo Castillo','7710001027','Cónyuge','Hermana Castillo','7710001028','Hermana',
   v_ase_c1, v_suc)
RETURNING id INTO v_c14;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Carlos','Cruz','Hernández','1984-05-11','MASCULINO','CASADO','7713001015',
   'HGO-C015','CUHC840511HHFXXX15',
   'Calle Cedros','22','Col. Jardines','Pachuca','Hidalgo','42015',
   'Tienda Naturista Cruz','Salud natural','3 años',
   'Esposa Cruz','7710001029','Cónyuge','Padre Cruz','7710001030','Padre',
   v_ase_c1, v_suc)
RETURNING id INTO v_c15;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Rocío','Morales','Gutiérrez','1992-07-18','FEMENINO','SOLTERO','7713001016',
   'HGO-C016','MOGR920718MHFXXX16',
   'Calle Jazmines','6','Col. Las Flores','Pachuca','Hidalgo','42016',
   'Antojitos Rocío','Comida','1 año',
   'Madre Morales','7710001031','Madre','Tía Morales','7710001032','Tía',
   v_ase_c2, v_suc)
RETURNING id INTO v_c16;

-- v_c17: Verónica Reyes — con coords del negocio
INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  negocio_lat, negocio_lng,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Verónica','Reyes','Alvarado','1989-02-28','FEMENINO','UNION_LIBRE','7713001017',
   'HGO-C017','REAV890228MHFXXX17',
   'Calle Bugambilias','11','Col. Jardines del Valle','Pachuca','Hidalgo','42017',
   'Cosméticos y Perfumería Vero','Belleza','3 años',
   20.1177, -98.7305,
   'Hermana Reyes','7710001033','Hermana','Vecina Reyes','7710001034','Vecina',
   v_ase_c3, v_suc)
RETURNING id INTO v_c17;

-- v_c18: Hugo Morales — con coords + docs
INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  negocio_lat, negocio_lng,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Hugo','Morales','Barrera','1977-10-14','MASCULINO','CASADO','7713001018',
   'HGO-C018','MOBH771014HHFXXX18',
   'Av. Revolución','78','Col. 20 de Noviembre','Pachuca','Hidalgo','42018',
   'Herrería y Soldadura Morales','Herrería','12 años',
   20.1234, -98.7412,
   'Esposa Morales','7710001035','Cónyuge','Compadre Morales','7710001036','Compadre',
   v_ase_c3, v_suc)
RETURNING id INTO v_c18;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('Alejandra','López','Fuentes','1994-04-05','FEMENINO','SOLTERO','7713001019',
   'HGO-C019','LOFA940405MHFXXX19',
   'Privada Azaleas','3','Col. Jardines','Pachuca','Hidalgo','42019',
   'Dulcería La Alegría','Dulces y botanas','2 años',
   'Madre López','7710001037','Madre','Hermano López','7710001038','Hermano',
   v_ase_c3, v_suc)
RETURNING id INTO v_c19;

INSERT INTO clientes (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id)
VALUES
  ('David','Hernández','Ríos','1987-09-30','MASCULINO','CASADO','7713001020',
   'HGO-C020','HERE870930HHFXXX20',
   'Calle Nogal','44','Col. Las Huertas','Pachuca','Hidalgo','42020',
   'Plomería y Gas Hernández','Plomería','6 años',
   'Esposa Hernández','7710001039','Cónyuge','Hermana Hernández','7710001040','Hermana',
   v_ase_c2, v_suc)
RETURNING id INTO v_c20;

-- ════════════════════════════════════════════════════════════════
-- B. CRÉDITOS CENTRO
-- ════════════════════════════════════════════════════════════════
-- Nota: créditos RENOVADO ya no necesitan estado intermedio,
-- los insertamos directamente en el estado final.
-- tipo='RENOVACION' en créditos generados por renovación (V12).

-- ──────────────────────────────────────────────────────────────
-- B1. ELENA VEGA — Cadena de 3 renovaciones encadenadas
--     Crédito 1 ($10,000 25d 30%) → Renovado Feb 17
--     Crédito 2 ($12,000 25d 30%) → Renovado Mar 18
--     Crédito 3 ($14,000 25d 30%) → ACTIVO pago 17, elegible
-- ──────────────────────────────────────────────────────────────

-- Crédito 1 (RENOVADO, tipo NUEVO — origen)
-- $10,000: cargo=$3,000, total=$13,000, pago=$520
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c1, v_ase_c1, v_suc, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-01-15','2026-02-13','2026-01-15 09:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_elena_cr1;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_elena_cr1, i, '2026-01-15'::date + (i-1), 520, 'PAGADO');
END LOOP;

-- Crédito 2 (RENOVADO, tipo RENOVACION)
-- $12,000: cargo=$3,600, total=$15,600, pago=$624
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c1, v_ase_c1, v_suc, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'RENOVACION',
  '2026-02-17','2026-03-17','2026-02-17 09:30:00-06','RENOVADO',v_admin)
RETURNING id INTO v_elena_cr2;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_elena_cr2, i, '2026-02-17'::date + (i-1), 624, 'PAGADO');
END LOOP;

-- Crédito 3 (ACTIVO, tipo RENOVACION) — en pago 17, elegible
-- $14,000: cargo=$4,200, total=$18,200, pago=$728
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c1, v_ase_c1, v_suc, 14000,14000,14000, 0.30,4200,18200,728,
  25,'DIARIO',728,'RENOVACION',
  'Báscula comercial y estantería metálica',
  '2026-03-18','2026-04-16','2026-03-18 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_elena_cr3;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_elena_cr3, i, '2026-03-18'::date + (i-1), 728,
    CASE WHEN i <= 17 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

-- Pagos registrados crédito 3 (17 pagos)
FOR i IN 1..17 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_elena_cr3, v_c1, v_ase_c1, i, '2026-03-18'::date + (i-1), 728, 728, TRUE,  v_ase_c1,
    ('2026-03-18'::date + (i-1))::timestamptz + '08:45:00');
END LOOP;

-- Renovación 1→2 (APROBADO)
-- pagos_restantes=3, monto=1560, multas=0, adelantado=624
-- desembolso: 12000 - 1560 - 0 - 624 = 9816
INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion, created_by)
VALUES (v_elena_cr1, v_elena_cr2, v_c1, v_ase_c1,
  '2026-02-17', 3, 1560, 0, 624,
  9816, 12000, 'DIARIO', 'APROBADO', v_admin, '2026-02-17 09:00:00-06', v_admin);

-- Renovación 2→3 (APROBADO)
-- pagos_restantes=3, monto=1872, multas=0, adelantado=728
-- desembolso: 14000 - 1872 - 0 - 728 = 11400
INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_elena_cr2, v_elena_cr3, v_c1, v_ase_c1,
  '2026-03-18', 3, 1872, 0, 728,
  11400, 14000, 'DIARIO', 'APROBADO', v_admin, '2026-03-18 09:30:00-06',
  'Báscula comercial y estantería metálica', v_admin);

-- ──────────────────────────────────────────────────────────────
-- B2. RENOVACIONES SEMANA ACTUAL (Abr 14–18, 2026) — APROBADO
-- ──────────────────────────────────────────────────────────────

-- MARÍA GARCÍA: $15,000 → $17,000 (Lun 14 abr)
-- Anterior: 25d, 24%, pago=744, 3 restantes → monto=2232
-- Nuevo: $17,000×0.24=4080, total=21080, pago=843.20
-- Desembolso: 17000-2232-0-843.20 = 13924.80
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c2, v_ase_c1, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO','Licuadora industrial y vitrina de exhibición',
  '2026-03-10','2026-04-08','2026-03-10 09:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-10'::date + (i-1), 744, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c2, v_ase_c1, v_suc, 17000,17000,17000, 0.24,4080,21080,843.20,
  25,'DIARIO',843.20,'RENOVACION','Licuadora industrial y vitrina de exhibición',
  '2026-04-14','2026-05-12','2026-04-14 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-14'::date + (i-1), 843.20,
    CASE WHEN i <= 4 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..4 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c2, v_ase_c1, i, '2026-04-14'::date+(i-1), 843.20,843.20,TRUE,v_ase_c1,
    ('2026-04-14'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_ca, v_cn, v_c2, v_ase_c1, '2026-04-14', 3,2232, 0,843.20,
  13924.80, 17000,'DIARIO','APROBADO',v_admin,'2026-04-14 09:45:00-06',
  'Licuadora industrial y vitrina de exhibición',v_admin);

-- JOSÉ MARTÍNEZ: $10,000 → $12,000 (Lun 14 abr)
-- Anterior: 25d, 30%, pago=520, 2 restantes → monto=1040
-- Nuevo: pago=624. Desembolso: 12000-1040-0-624 = 10336
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c3, v_ase_c2, v_suc, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO','Herramientas de taller y compresor de aire',
  '2026-03-12','2026-04-10','2026-03-12 08:30:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-12'::date + (i-1), 520, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c3, v_ase_c2, v_suc, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'RENOVACION','Herramientas de taller y compresor de aire',
  '2026-04-14','2026-05-12','2026-04-14 09:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-14'::date + (i-1), 624,
    CASE WHEN i <= 4 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..4 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c3, v_ase_c2, i, '2026-04-14'::date+(i-1), 624,624,TRUE,v_ase_c2,
    ('2026-04-14'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_ca, v_cn, v_c3, v_ase_c2, '2026-04-14', 2,1040, 0,624,
  10336, 12000,'DIARIO','APROBADO',v_admin,'2026-04-14 08:45:00-06',
  'Herramientas de taller y compresor de aire',v_admin);

-- ANA LÓPEZ: $20,000 → $22,000 30d (Mié 15 abr)
-- Anterior: 30d, 24%, pago=826.67, 4 restantes → monto=3306.68
-- Nuevo: $22k×0.24=5280, total=27280, pago=909.33
-- Desembolso: 22000-3306.68-0-909.33 = 17783.99
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c4, v_ase_c1, v_suc, 20000,20000,20000, 0.24,4800,24800,826.67,
  30,'DIARIO',826.67,'NUEVO','Silla de estética profesional y espejo grande',
  '2026-03-08','2026-04-11','2026-03-08 10:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-08'::date + (i-1), 826.67, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c4, v_ase_c1, v_suc, 22000,22000,22000, 0.24,5280,27280,909.33,
  30,'DIARIO',909.33,'RENOVACION','Silla de estética profesional y espejo grande',
  '2026-04-15','2026-05-19','2026-04-15 10:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-15'::date + (i-1), 909.33,
    CASE WHEN i <= 3 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..3 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c4, v_ase_c1, i, '2026-04-15'::date+(i-1), 909.33,909.33,TRUE,v_ase_c1,
    ('2026-04-15'::date+(i-1))::timestamptz+'10:15:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_ca, v_cn, v_c4, v_ase_c1, '2026-04-15', 4,3306.68, 0,909.33,
  17783.99, 22000,'DIARIO','APROBADO',v_admin,'2026-04-15 10:00:00-06',
  'Silla de estética profesional y espejo grande',v_admin);

-- PEDRO RAMÍREZ: $15,000 → $15,000 con multa $100 (Jue 16 abr)
-- Anterior: 25d, 24%, pago=744, 1 restante, multa=100
-- Desembolso: 15000-744-100-744 = 13412
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c5, v_ase_c2, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO','Refrigerador de vitrina para carnes',
  '2026-03-16','2026-04-14','2026-03-16 08:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-16'::date + (i-1), 744,
    CASE WHEN i = 10 THEN 'NO_PAGADO' ELSE 'PAGADO' END);
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c5, v_ase_c2, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'RENOVACION','Refrigerador de vitrina para carnes',
  '2026-04-16','2026-05-14','2026-04-16 09:15:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-16'::date + (i-1), 744,
    CASE WHEN i <= 2 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..2 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c5, v_ase_c2, i, '2026-04-16'::date+(i-1), 744,744,TRUE,v_ase_c2,
    ('2026-04-16'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_ca, v_cn, v_c5, v_ase_c2, '2026-04-16', 1,744, 100,744,
  13412, 15000,'DIARIO','APROBADO',v_admin,'2026-04-16 09:00:00-06',
  'Refrigerador de vitrina para carnes',v_admin);

-- LUCÍA TORRES: $12,000 → $14,000 (Vie 18 abr)
-- Anterior: 25d, 30%, pago=624, 2 restantes → monto=1248
-- Nuevo: pago=728. Desembolso: 14000-1248-0-728 = 12024
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c6, v_ase_c1, v_suc, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO','Utensilios de cocina y tanque de gas',
  '2026-03-19','2026-04-17','2026-03-19 09:30:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-19'::date + (i-1), 624, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c6, v_ase_c1, v_suc, 14000,14000,14000, 0.30,4200,18200,728,
  25,'DIARIO',728,'RENOVACION','Utensilios de cocina y tanque de gas',
  '2026-04-18','2026-05-16','2026-04-18 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-18'::date + (i-1), 728,
    CASE WHEN i <= 2 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..2 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c6, v_ase_c1, i, '2026-04-18'::date+(i-1), 728,728,TRUE,v_ase_c1,
    ('2026-04-18'::date+(i-1))::timestamptz+'09:30:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion,
  garantia_descripcion, created_by)
VALUES (v_ca, v_cn, v_c6, v_ase_c1, '2026-04-18', 2,1248, 0,728,
  12024, 14000,'DIARIO','APROBADO',v_admin,'2026-04-18 09:45:00-06',
  'Utensilios de cocina y tanque de gas',v_admin);

-- ──────────────────────────────────────────────────────────────
-- B3. RENOVACIONES SOLICITADAS — PENDIENTES DE APROBACIÓN
-- ──────────────────────────────────────────────────────────────

-- ISABEL CRUZ: $15,000 25d, pago 20, 5 restantes → SOLICITADO (por asesor carlos)
-- pago=744, monto_restante=5×744=3720, multas=0
-- Solicita $18,000 25d 24%: cargo=4320, total=22320, pago=892.80
-- Desembolso: 18000-3720-0-892.80 = 13387.20
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c7, v_ase_c1, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO',
  '2026-03-14','2026-04-12','2026-03-14 08:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_sol_isabel;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_sol_isabel, i, '2026-03-14'::date + (i-1), 744,
    CASE WHEN i <= 20 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..20 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_sol_isabel, v_c7, v_ase_c1, i, '2026-03-14'::date+(i-1), 744,744,TRUE,v_ase_c1,
    ('2026-03-14'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

-- Solicitud SOLICITADO (credito_nuevo_id = NULL)
INSERT INTO renovaciones (credito_anterior_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, created_by)
VALUES (v_sol_isabel, v_c7, v_ase_c1,
  '2026-04-18', 5,3720, 0,892.80,
  13387.20, 18000,'DIARIO','SOLICITADO',v_ase_c1);

-- RAMÓN CASTILLO: $20,000 30d, pago 22, 8 restantes → SOLICITADO (por supervisor_campo)
-- pago=826.67, monto_restante=8×826.67=6613.36, multas=100
-- Solicita $25,000 30d 24%: cargo=6000, total=31000, pago=1033.33
-- Desembolso: 25000-6613.36-100-1033.33 = 17253.31
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c8, v_ase_c2, v_suc, 20000,20000,20000, 0.24,4800,24800,826.67,
  30,'DIARIO',826.67,'NUEVO','Maquinaria para corte de cuero y cajas de almacenaje',
  '2026-03-08','2026-04-11','2026-03-08 09:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_sol_ramon;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_sol_ramon, i, '2026-03-08'::date + (i-1), 826.67,
    CASE WHEN i <= 22 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

-- Pagos + 1 no pago con multa (día 15, genera multa $100 por crédito >= $15k)
FOR i IN 1..22 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, razon_no_pago, multa_aplicada,
    registrado_por, created_at)
  VALUES (v_sol_ramon, v_c8, v_ase_c2, i,
    CASE WHEN i = 15 THEN '2026-03-22' ELSE '2026-03-08'::date+(i-1) END,
    CASE WHEN i = 15 THEN 0 ELSE 826.67 END,
    826.67,
    CASE WHEN i = 15 THEN FALSE ELSE TRUE END,
    CASE WHEN i = 15 THEN 'No se encontraba en casa' ELSE NULL END,
    CASE WHEN i = 15 THEN 100 ELSE 0 END,
    v_ase_c2,
    ('2026-03-08'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES (v_c8, v_sol_ramon, 'NO_PAGO', 100, '2026-03-22', FALSE);

-- Solicitud por supervisor_campo
INSERT INTO renovaciones (credito_anterior_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado,
  garantia_descripcion, created_by)
VALUES (v_sol_ramon, v_c8, v_sup_cen,
  '2026-04-19', 8,6613.36, 100,1033.33,
  17253.31, 25000,'DIARIO','SOLICITADO',
  'Maquinaria para corte de cuero y cajas de almacenaje',v_sup_cen);

-- VERÓNICA REYES: $6,000 25d, pago 17, 8 restantes — CASI CERO desembolso
-- pago=312, monto_restante=8×312=2496, multas=200 (4 no pagos × $50)
-- Solicita $3,000 25d 30%: cargo=900, total=3900, pago=156
-- Desembolso: 3000-2496-200-156 = 148 ← caso edge
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c17, v_ase_c3, v_suc, 6000,6000,6000, 0.30,1800,7800,312,
  25,'DIARIO',312,'NUEVO',
  '2026-03-20','2026-04-18','2026-03-20 09:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_sol_vero;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_sol_vero, i, '2026-03-20'::date + (i-1), 312,
    CASE
      WHEN i IN (5,9,13,16) THEN 'NO_PAGADO'
      WHEN i <= 17           THEN 'PAGADO'
      ELSE 'PENDIENTE'
    END);
END LOOP;

-- Pagos registrados (17 total, 4 son no-pagos)
FOR i IN 1..17 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, razon_no_pago, multa_aplicada,
    registrado_por, created_at)
  VALUES (v_sol_vero, v_c17, v_ase_c3, i, '2026-03-20'::date+(i-1),
    CASE WHEN i IN (5,9,13,16) THEN 0 ELSE 312 END,
    312,
    CASE WHEN i IN (5,9,13,16) THEN FALSE ELSE TRUE END,
    CASE WHEN i IN (5,9,13,16) THEN 'No pagó, no abrió el negocio' ELSE NULL END,
    CASE WHEN i IN (5,9,13,16) THEN 50 ELSE 0 END,
    v_ase_c3,
    ('2026-03-20'::date+(i-1))::timestamptz+'09:15:00');
END LOOP;

INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES
  (v_c17, v_sol_vero, 'NO_PAGO', 50, '2026-03-24', FALSE),
  (v_c17, v_sol_vero, 'NO_PAGO', 50, '2026-03-28', FALSE),
  (v_c17, v_sol_vero, 'NO_PAGO', 50, '2026-04-01', FALSE),
  (v_c17, v_sol_vero, 'NO_PAGO', 50, '2026-04-04', FALSE);

INSERT INTO renovaciones (credito_anterior_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, created_by)
VALUES (v_sol_vero, v_c17, v_ase_c3,
  '2026-04-19', 8,2496, 200,156,
  148, 3000,'DIARIO','SOLICITADO',v_ase_c3);

-- ──────────────────────────────────────────────────────────────
-- B4. TOMÁS LUNA — RECHAZADO con motivo
-- $12,000 25d 30%, pago 18, crédito sigue ACTIVO
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c9, v_ase_c1, v_suc, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO',
  '2026-03-16','2026-04-14','2026-03-16 08:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_rec_tomas;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_rec_tomas, i, '2026-03-16'::date + (i-1), 624,
    CASE WHEN i <= 18 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..18 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_rec_tomas, v_c9, v_ase_c1, i, '2026-03-16'::date+(i-1), 624,624,TRUE,v_ase_c1,
    ('2026-03-16'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

-- Renovación RECHAZADA (credito_nuevo_id = NULL, crédito sigue ACTIVO)
-- Solicitaba $15,000: pago=744, desembolso=15000-4368-0-744=9888
INSERT INTO renovaciones (credito_anterior_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado,
  aprobado_por, fecha_aprobacion, motivo_rechazo, created_by)
VALUES (v_rec_tomas, v_c9, v_ase_c1,
  '2026-04-08', 7,4368, 0,744,
  9888, 15000,'DIARIO','RECHAZADO',
  v_admin, '2026-04-09 11:00:00-06',
  'Monto solicitado supera el historial del cliente. Reenviar solicitud con $12,000 máximo.',
  v_ase_c1);

-- ──────────────────────────────────────────────────────────────
-- B5. DANIELA MEDINA — ACTIVO con multas, pago 18, listo para renovar
-- $10,000 25d 30%, 2 no-pagos → multas $100, visible en "Listos para Renovar"
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c10, v_ase_c2, v_suc, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO',
  '2026-03-14','2026-04-12','2026-03-14 08:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-03-14'::date + (i-1), 520,
    CASE
      WHEN i IN (7,14)  THEN 'NO_PAGADO'
      WHEN i <= 18       THEN 'PAGADO'
      ELSE 'PENDIENTE'
    END);
END LOOP;

FOR i IN 1..18 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, razon_no_pago, multa_aplicada,
    registrado_por, created_at)
  VALUES (v_cn, v_c10, v_ase_c2, i, '2026-03-14'::date+(i-1),
    CASE WHEN i IN (7,14) THEN 0 ELSE 520 END,
    520,
    CASE WHEN i IN (7,14) THEN FALSE ELSE TRUE END,
    CASE WHEN i IN (7,14) THEN 'Negocio cerrado por enfermedad' ELSE NULL END,
    CASE WHEN i IN (7,14) THEN 50 ELSE 0 END,
    v_ase_c2,
    ('2026-03-14'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES
  (v_c10, v_cn, 'NO_PAGO', 50, '2026-03-20', FALSE),
  (v_c10, v_cn, 'NO_PAGO', 50, '2026-03-27', FALSE);

-- ──────────────────────────────────────────────────────────────
-- B6. CRÉDITOS TEMPRANOS (pagos 3-8, no elegibles)
-- ──────────────────────────────────────────────────────────────

-- ROBERTO FLORES: $15,000 25d, pago 5
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c11, v_ase_c2, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO',
  '2026-04-13','2026-05-11','2026-04-13 08:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-13'::date + (i-1), 744,
    CASE WHEN i <= 5 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..5 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c11, v_ase_c2, i, '2026-04-13'::date+(i-1), 744,744,TRUE,v_ase_c2,
    ('2026-04-13'::date+(i-1))::timestamptz+'08:45:00');
END LOOP;

-- SOFÍA HERRERA: $10,000 25d, pago 4
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c12, v_ase_c1, v_suc, 10000,10000,10000, 0.30,3000,13000,520,
  25,'DIARIO',520,'NUEVO','Estantería y silla de cómputo',
  '2026-04-14','2026-05-12','2026-04-14 08:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-14'::date + (i-1), 520,
    CASE WHEN i <= 4 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..4 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c12, v_ase_c1, i, '2026-04-14'::date+(i-1), 520,520,TRUE,v_ase_c1,
    ('2026-04-14'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- B7. CRÉDITOS GRANDES 30 DÍAS
-- ──────────────────────────────────────────────────────────────

-- FERNANDO SALINAS: $30,000 30d 24%, pago 6
-- cargo=7200, total=37200, pago=1240
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c13, v_ase_c2, v_suc, 30000,30000,30000, 0.24,7200,37200,1240,
  30,'DIARIO',1240,'NUEVO','Camioneta de reparto 2020 placas HGO-1234',
  '2026-04-12','2026-05-16','2026-04-12 09:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-12'::date + (i-1), 1240,
    CASE WHEN i <= 6 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..6 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c13, v_ase_c2, i, '2026-04-12'::date+(i-1), 1240,1240,TRUE,v_ase_c2,
    ('2026-04-12'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

-- PATRICIA CASTILLO: $25,000 30d 24%, pago 20, elegible (umbral=19)
-- cargo=6000, total=31000, pago=1033.33
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo, garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c14, v_ase_c1, v_suc, 25000,25000,25000, 0.24,6000,31000,1033.33,
  30,'DIARIO',1033.33,'NUEVO','Inventario de ropa importada y maniquíes',
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
  VALUES (v_cn, v_c14, v_ase_c1, i, '2026-03-12'::date+(i-1), 1033.33,1033.33,TRUE,v_ase_c1,
    ('2026-03-12'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

-- ─── Renovación APROBADO pendiente de desembolso (Patricia Castillo) ─────────
-- Crédito anterior: $25,000 30d, pago=1033.33, 10 pagos restantes
-- Monto solicitado: 28000, monto aprobado: 30000
-- pago_periodico nuevo ($30,000 24%): cargo=7200, total=37200, pago=1488
SELECT id INTO v_ca FROM creditos WHERE cliente_id = v_c14 AND estado = 'ACTIVO' LIMIT 1;

INSERT INTO renovaciones (
    credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
    estado, monto_nuevo, monto_aprobado, tipo_pago,
    pagos_restantes, monto_pagos_restantes, multas_pendientes,
    pago_adelantado, monto_desembolso,
    aprobado_por, fecha_aprobacion,
    fecha, created_by, created_at, updated_at
) VALUES (
    v_ca, NULL, v_c14, v_ase_c1,
    'APROBADO', 28000.00, 30000.00, 'DIARIO',
    10, 10333.30, 0.00,
    1488.00,
    30000.00 - 10333.30 - 1488.00,
    v_sup_cen, NOW() - INTERVAL '1 hour',
    CURRENT_DATE, v_ase_c1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'
) RETURNING id INTO v_ren_aprobada;

-- ──────────────────────────────────────────────────────────────
-- B8. CRÉDITO PAGADO y CANCELADO
-- ──────────────────────────────────────────────────────────────

-- CARLOS CRUZ: $8,000 25d 30%, todos pagados
-- cargo=2400, total=10400, pago=416
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c15, v_ase_c1, v_suc, 8000,8000,8000, 0.30,2400,10400,416,
  25,'DIARIO',416,'NUEVO',
  '2026-01-20','2026-02-18','2026-01-20 08:00:00-06','PAGADO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-01-20'::date + (i-1), 416, 'PAGADO');
END LOOP;

-- ROCÍO MORALES: $5,000 25d 30%, cancelado en pago 5
-- cargo=1500, total=6500, pago=260
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c16, v_ase_c2, v_suc, 5000,5000,5000, 0.30,1500,6500,260,
  25,'DIARIO',260,'NUEVO',
  '2026-02-03','2026-03-04','2026-02-03 08:00:00-06','CANCELADO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-02-03'::date + (i-1), 260,
    CASE WHEN i <= 5 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- B9. HUGO MORALES — ACTIVO pago 7 (con docs en Parte 3)
-- $7,000 25d 30%, cargo=2100, total=9100, pago=364
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c18, v_ase_c3, v_suc, 7000,7000,7000, 0.30,2100,9100,364,
  25,'DIARIO',364,'NUEVO',
  '2026-04-10','2026-05-08','2026-04-10 09:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-10'::date + (i-1), 364,
    CASE WHEN i <= 7 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..7 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c18, v_ase_c3, i, '2026-04-10'::date+(i-1), 364,364,TRUE,v_ase_c3,
    ('2026-04-10'::date+(i-1))::timestamptz+'09:30:00');
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- B10. ALEJANDRA LÓPEZ — ACTIVO pago 8 con pagos incompletos
-- $12,000 25d 30%, pago=624, días 3 y 6 → PARCIAL ($400 c/u)
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c19, v_ase_c3, v_suc, 12000,12000,12000, 0.30,3600,15600,624,
  25,'DIARIO',624,'NUEVO',
  '2026-04-09','2026-05-07','2026-04-09 08:30:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-09'::date + (i-1), 624,
    CASE
      WHEN i IN (3,6) THEN 'PARCIAL'
      WHEN i <= 8    THEN 'PAGADO'
      ELSE 'PENDIENTE'
    END);
END LOOP;

FOR i IN 1..8 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c19, v_ase_c3, i, '2026-04-09'::date+(i-1),
    CASE WHEN i IN (3,6) THEN 400 ELSE 624 END,
    624,
    CASE WHEN i IN (3,6) THEN FALSE ELSE TRUE END,
    v_ase_c3,
    ('2026-04-09'::date+(i-1))::timestamptz+'08:30:00');
END LOOP;

-- Multa por 2 incompletos acumulados (tipo INCOMPLETO, se genera en pago 4)
INSERT INTO multas (cliente_id, credito_id, tipo, monto, fecha, cobrada)
VALUES (v_c19, v_cn, 'INCOMPLETO', 50, '2026-04-12', FALSE);

-- ──────────────────────────────────────────────────────────────
-- B11. DAVID HERNÁNDEZ — Semana anterior (Lun 6 abr)
-- $15,000 → $17,000, APROBADO, nuevo en pago 11
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c20, v_ase_c2, v_suc, 15000,15000,15000, 0.24,3600,18600,744,
  25,'DIARIO',744,'NUEVO',
  '2026-03-03','2026-04-01','2026-03-03 09:00:00-06','RENOVADO',v_admin)
RETURNING id INTO v_ca;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca, i, '2026-03-03'::date + (i-1), 744, 'PAGADO');
END LOOP;

INSERT INTO creditos (cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado, tipo,
  fecha_inicio, fecha_vencimiento, fecha_desembolso, estado, created_by)
VALUES (v_c20, v_ase_c2, v_suc, 17000,17000,17000, 0.24,4080,21080,843.20,
  25,'DIARIO',843.20,'RENOVACION',
  '2026-04-06','2026-05-04','2026-04-06 10:00:00-06','ACTIVO',v_admin)
RETURNING id INTO v_cn;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn, i, '2026-04-06'::date + (i-1), 843.20,
    CASE WHEN i <= 11 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;
FOR i IN 1..11 LOOP
  INSERT INTO pagos (credito_id, cliente_id, asesor_id, numero_pago, fecha_pago,
    monto_recibido, monto_esperado, es_completo, registrado_por, created_at)
  VALUES (v_cn, v_c20, v_ase_c2, i, '2026-04-06'::date+(i-1), 843.20,843.20,TRUE,v_ase_c2,
    ('2026-04-06'::date+(i-1))::timestamptz+'09:00:00');
END LOOP;

INSERT INTO renovaciones (credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado,
  monto_desembolso, monto_nuevo, tipo_pago, estado, aprobado_por, fecha_aprobacion, created_by)
VALUES (v_ca, v_cn, v_c20, v_ase_c2, '2026-04-06', 3,2232, 0,843.20,
  13924.80, 17000,'DIARIO','APROBADO',v_admin,'2026-04-06 09:45:00-06',v_admin);

-- ════════════════════════════════════════════════════════════════
-- C. EXPORTAR IDs de clientes para Parte 3
-- ════════════════════════════════════════════════════════════════
INSERT INTO magno_seed_ids VALUES
  ('c1',v_c1),('c2',v_c2),('c3',v_c3),('c4',v_c4),('c5',v_c5),
  ('c6',v_c6),('c7',v_c7),('c8',v_c8),('c9',v_c9),('c10',v_c10),
  ('c11',v_c11),('c12',v_c12),('c13',v_c13),('c14',v_c14),('c15',v_c15),
  ('c16',v_c16),('c17',v_c17),('c18',v_c18),('c19',v_c19),('c20',v_c20)
ON CONFLICT (clave) DO UPDATE SET val = EXCLUDED.val;

RAISE NOTICE '✓ Parte 2 completada: 20 clientes Centro, créditos, renovaciones, pagos, multas';

END $$;
