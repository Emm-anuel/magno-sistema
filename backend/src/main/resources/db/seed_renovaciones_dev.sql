-- ============================================================
-- MAGNO — Datos dummy: Módulo 5 Renovaciones
-- Ejecutar UNA VEZ en base de datos de desarrollo.
-- NO es un changeset de Liquibase.
--
-- Crea: 1 sucursal, 3 usuarios, 14 clientes,
--       créditos anteriores (RENOVADO), nuevos (ACTIVO),
--       renovaciones y calendarios de pago.
--
-- Contraseña de todos los usuarios demo: password123
--
-- Semana visible en TabColocaciones: lun 14 – vie 18 abr 2026
-- Semana anterior navegable:         lun 06 – vie 10 abr 2026
-- Clientes listos para renovar:      2 (TabNuevaRenovacion)
-- ============================================================

DO $$
DECLARE
  -- Entidades base
  v_suc     BIGINT;
  v_admin   BIGINT;
  v_asesor1 BIGINT;  -- Carlos Mendoza
  v_asesor2 BIGINT;  -- Laura Sánchez

  -- Clientes semana actual (5 renovaciones + 2 créditos nuevos)
  v_c1 BIGINT; v_c2 BIGINT; v_c3 BIGINT; v_c4 BIGINT; v_c5 BIGINT;
  v_c6 BIGINT; v_c7 BIGINT;

  -- Clientes semana anterior (3 renovaciones + 2 créditos nuevos)
  v_c8 BIGINT; v_c9 BIGINT; v_c10 BIGINT; v_c11 BIGINT; v_c12 BIGINT;

  -- Clientes elegibles para renovar (demo de TabNuevaRenovacion)
  v_c13 BIGINT; v_c14 BIGINT;

  -- Créditos anteriores RENOVADO — semana actual
  v_ca1 BIGINT; v_ca2 BIGINT; v_ca3 BIGINT; v_ca4 BIGINT; v_ca5 BIGINT;

  -- Créditos nuevos ACTIVO de renovaciones — semana actual
  v_cn1 BIGINT; v_cn2 BIGINT; v_cn3 BIGINT; v_cn4 BIGINT; v_cn5 BIGINT;

  -- Créditos nuevos (tipo NUEVO) — semana actual
  v_cnv1 BIGINT; v_cnv2 BIGINT;

  -- Créditos anteriores RENOVADO — semana anterior
  v_ca8 BIGINT; v_ca9 BIGINT; v_ca10 BIGINT;

  -- Créditos nuevos ACTIVO de renovaciones — semana anterior
  v_cn8 BIGINT; v_cn9 BIGINT; v_cn10 BIGINT;

  -- Créditos nuevos (tipo NUEVO) — semana anterior
  v_cnv8 BIGINT; v_cnv9 BIGINT;

  -- Créditos activos listos para renovar
  v_cd13 BIGINT; v_cd14 BIGINT;

  i INT;

BEGIN

-- ────────────────────────────────────────────────────────────────
-- 1. SUCURSAL
-- ────────────────────────────────────────────────────────────────

INSERT INTO sucursales (nombre, direccion, telefono, multa_base, ahorro_diario, activa)
VALUES ('Sucursal Matriz', 'Av. Hidalgo 100, Centro, Pachuca', '7712000001', 50.00, 2000.00, TRUE)
ON CONFLICT DO NOTHING;

SELECT id INTO v_suc FROM sucursales ORDER BY id LIMIT 1;

-- ────────────────────────────────────────────────────────────────
-- 2. USUARIOS (contraseña: password123)
-- Hash BCrypt v2a: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- ────────────────────────────────────────────────────────────────

INSERT INTO usuarios (
  nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id,
  calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco
)
SELECT 'Gerente General Demo', 'admin@magno.mx',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '7712000002',
  (SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR'), v_suc,
  'Calle Central', '1', 'Centro', 'Pachuca', 'Hidalgo', '42000', 'ADM-001',
  'Contacto Emergencia', '7711000001', 'Familiar',
  'Contacto Emergencia 2', '7711000002', 'Familiar'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@magno.mx');

SELECT id INTO v_admin FROM usuarios WHERE email = 'admin@magno.mx';

INSERT INTO usuarios (
  nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id,
  calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco
)
SELECT 'Carlos Mendoza López', 'carlos@magno.mx',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '7712000003',
  (SELECT id FROM roles WHERE nombre = 'ASESOR_COBRADOR'), v_suc,
  'Av. Juárez', '45', 'San Francisco', 'Pachuca', 'Hidalgo', '42010', 'HGO-CARL-001',
  'Esposa de Carlos', '7711000003', 'Cónyuge',
  'Hermano de Carlos', '7711000004', 'Hermano'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'carlos@magno.mx');

SELECT id INTO v_asesor1 FROM usuarios WHERE email = 'carlos@magno.mx';

INSERT INTO usuarios (
  nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id,
  calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco
)
SELECT 'Laura Sánchez Ruiz', 'laura@magno.mx',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '7712000004',
  (SELECT id FROM roles WHERE nombre = 'ASESOR_COBRADOR'), v_suc,
  'Blvd. Valle', '22', 'Valle Grande', 'Pachuca', 'Hidalgo', '42020', 'HGO-LAUR-001',
  'Madre de Laura', '7711000005', 'Madre',
  'Padre de Laura', '7711000006', 'Padre'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'laura@magno.mx');

SELECT id INTO v_asesor2 FROM usuarios WHERE email = 'laura@magno.mx';

-- ────────────────────────────────────────────────────────────────
-- 3. CLIENTES — semana actual (5 para renovar + 2 nuevos)
-- ────────────────────────────────────────────────────────────────

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'María', 'García', 'Pérez', '1985-03-15',
  'FEMENINO', 'CASADO', '7713001001', 'HGO-C001', 'GAPE850315MHFXXX01',
  'Calle Hidalgo', '10', 'Col. Centro', 'Pachuca', 'Hidalgo', '42001',
  'Tortillería La Paloma', 'Alimentos', '4 años',
  'Hermana García', '7710001001', 'Hermana',
  'Prima García', '7710001002', 'Prima',
  v_asesor1, v_suc
) RETURNING id INTO v_c1;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'José', 'Martínez', 'Flores', '1978-07-20',
  'MASCULINO', 'CASADO', '7713001002', 'HGO-C002', 'MAFJ780720HHFXXX02',
  'Calle Reforma', '20', 'Col. Morelos', 'Pachuca', 'Hidalgo', '42002',
  'Taller Mecánico JM', 'Servicios automotrices', '6 años',
  'Esposa Martínez', '7710001003', 'Cónyuge',
  'Amigo Martínez', '7710001004', 'Amigo',
  v_asesor2, v_suc
) RETURNING id INTO v_c2;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'Ana', 'López', 'Cruz', '1990-11-05',
  'FEMENINO', 'SOLTERO', '7713001003', 'HGO-C003', 'LOCA901105MHFXXX03',
  'Blvd. Independencia', '35', 'Col. La Providencia', 'Pachuca', 'Hidalgo', '42003',
  'Estética Beauty Ana', 'Belleza', '3 años',
  'Madre López', '7710001005', 'Madre',
  'Vecina López', '7710001006', 'Vecina',
  v_asesor1, v_suc
) RETURNING id INTO v_c3;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'Pedro', 'Ramírez', 'González', '1982-05-28',
  'MASCULINO', 'UNION_LIBRE', '7713001004', 'HGO-C004', 'RAGP820528HHFXXX04',
  'Calle Allende', '8', 'Col. San Juan', 'Pachuca', 'Hidalgo', '42004',
  'Carnicería Don Pedro', 'Carnes', '7 años',
  'Pareja Ramírez', '7710001007', 'Pareja',
  'Hermano Ramírez', '7710001008', 'Hermano',
  v_asesor2, v_suc
) RETURNING id INTO v_c4;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'Lucía', 'Torres', 'Morales', '1993-09-12',
  'FEMENINO', 'CASADO', '7713001005', 'HGO-C005', 'TOML930912MHFXXX05',
  'Calle Zaragoza', '55', 'Col. Las Flores', 'Pachuca', 'Hidalgo', '42005',
  'Cocina Económica Lucía', 'Restaurante', '2 años',
  'Esposo Torres', '7710001009', 'Cónyuge',
  'Cuñada Torres', '7710001010', 'Cuñada',
  v_asesor1, v_suc
) RETURNING id INTO v_c5;

-- Clientes para créditos nuevos (semana actual)
INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'Roberto', 'Flores', 'Díaz', '1988-02-14',
  'MASCULINO', 'SOLTERO', '7713001006', 'HGO-C006', 'FODR880214HHFXXX06',
  'Calle Morelos', '3', 'Col. Cuauhtémoc', 'Pachuca', 'Hidalgo', '42006',
  'Ferretería Flores', 'Ferretería', '5 años',
  'Madre Flores', '7710001011', 'Madre',
  'Hermano Flores', '7710001012', 'Hermano',
  v_asesor2, v_suc
) RETURNING id INTO v_c6;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES (
  'Sofía', 'Herrera', 'Vargas', '1995-06-30',
  'FEMENINO', 'SOLTERO', '7713001007', 'HGO-C007', 'HEVS950630MHFXXX07',
  'Privada del Sol', '7', 'Col. El Arbolillo', 'Pachuca', 'Hidalgo', '42007',
  'Papelería y Librería Sofía', 'Papelería', '2 años',
  'Madre Herrera', '7710001013', 'Madre',
  'Padre Herrera', '7710001014', 'Padre',
  v_asesor1, v_suc
) RETURNING id INTO v_c7;

-- ────────────────────────────────────────────────────────────────
-- 4. CLIENTES — semana anterior (3 renov + 2 nuevos)
-- ────────────────────────────────────────────────────────────────

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Elena','Vega','Ríos','1980-04-10','FEMENINO','CASADO','7713001008',
   'HGO-C008','VERE800410MHFXXX08',
   'Calle Guerrero','12','Col. Obrera','Pachuca','Hidalgo','42008',
   'Abarrotes Doña Elena','Abarrotes','8 años',
   'Hijo Vega','7710001015','Hijo','Vecina Vega','7710001016','Vecina',
   v_asesor1, v_suc) RETURNING id INTO v_c8;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Miguel','Ortiz','Nava','1975-12-03','MASCULINO','CASADO','7713001009',
   'HGO-C009','OINM751203HHFXXX09',
   'Av. Universidad','88','Col. Universitaria','Pachuca','Hidalgo','42009',
   'Plomería Ortiz','Plomería','10 años',
   'Esposa Ortiz','7710001017','Cónyuge','Socio Ortiz','7710001018','Socio',
   v_asesor2, v_suc) RETURNING id INTO v_c9;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Carmen','Reyes','Salazar','1987-08-25','FEMENINO','UNION_LIBRE','7713001010',
   'HGO-C010','RESC870825MHFXXX10',
   'Priv. Magnolias','4','Col. Jardines','Pachuca','Hidalgo','42010',
   'Costura y Bordados Carmen','Ropa','3 años',
   'Hermana Reyes','7710001019','Hermana','Amiga Reyes','7710001020','Amiga',
   v_asesor1, v_suc) RETURNING id INTO v_c10;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Tomás','Luna','Espinoza','1983-01-17','MASCULINO','SOLTERO','7713001011',
   'HGO-C011','LUET830117HHFXXX11',
   'Calle Tulipanes','30','Col. Las Palmas','Pachuca','Hidalgo','42011',
   'Vulcanizadora Luna','Automotriz','4 años',
   'Madre Luna','7710001021','Madre','Hermana Luna','7710001022','Hermana',
   v_asesor2, v_suc) RETURNING id INTO v_c11;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Daniela','Medina','Rojas','1991-03-22','FEMENINO','CASADO','7713001012',
   'HGO-C012','MERD910322MHFXXX12',
   'Calle Pinos','16','Col. Los Pinos','Pachuca','Hidalgo','42012',
   'Frutería y Verduras Dani','Verduras','2 años',
   'Esposo Medina','7710001023','Cónyuge','Madre Medina','7710001024','Madre',
   v_asesor1, v_suc) RETURNING id INTO v_c12;

-- ────────────────────────────────────────────────────────────────
-- 5. CLIENTES — disponibles para renovar
-- ────────────────────────────────────────────────────────────────

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Isabel','Cruz','Jiménez','1986-10-08','FEMENINO','CASADO','7713001013',
   'HGO-C013','CUJI861008MHFXXX13',
   'Calle Robles','5','Col. El Roble','Pachuca','Hidalgo','42013',
   'Fondita Doña Isabel','Restaurante','6 años',
   'Esposo Cruz','7710001025','Cónyuge','Hermano Cruz','7710001026','Hermano',
   v_asesor1, v_suc) RETURNING id INTO v_c13;

INSERT INTO clientes (
  nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
  genero, estado_civil, celular, ine_numero, curp,
  dom_calle, dom_no_exterior, dom_colonia, dom_municipio, dom_estado, dom_codigo_postal,
  negocio_nombre, negocio_giro, negocio_antiguedad,
  ref1_nombre, ref1_telefono, ref1_parentesco,
  ref2_nombre, ref2_telefono, ref2_parentesco,
  asesor_id, sucursal_id
) VALUES
  ('Ramón','Castillo','Vargas','1979-06-14','MASCULINO','CASADO','7713001014',
   'HGO-C014','CAVR790614HHFXXX14',
   'Callejón Cedros','9','Col. Cedros','Pachuca','Hidalgo','42014',
   'Zapatería Castillo','Calzado','9 años',
   'Esposa Castillo','7710001027','Cónyuge','Hijo Castillo','7710001028','Hijo',
   v_asesor2, v_suc) RETURNING id INTO v_c14;

-- ════════════════════════════════════════════════════════════════
-- CRÉDITOS Y RENOVACIONES — SEMANA ACTUAL
-- lun 14 abr 2026 a vie 18 abr 2026
-- ════════════════════════════════════════════════════════════════
--
-- Tasas aplicadas según reglas de negocio:
--   < $15,000  → plazo=25d, tasa=30%
--   $15k–$19k  → plazo=25d, tasa=24%
--   ≥ $20,000  → plazo=30d, tasa=24%
--
-- Fórmula: cargo = capital * tasa
--          total = capital + cargo
--          pago  = total / plazo
--          adelantado = pago (primer pago al desembolso)
--          desembolso = montoNuevo - pagosRestantes - multas - adelantado

-- ──────────────────────────────────────────────────────────────
-- REN-1: María García — $15,000 → $17,000 — Mar 14 abr — RUTA
-- ──────────────────────────────────────────────────────────────
-- Crédito anterior: $15,000, 25d, 24%, pago=744, 3 pendientes
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c1, v_asesor1, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  'Licuadora industrial y vitrina de exhibición',
  '2026-03-10', '2026-04-10',
  '2026-03-10 09:00:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca1;

-- Calendario: 22 pagados + 3 pendientes (todos marcamos PAGADO por la renovación)
FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca1, i, '2026-03-10'::date + (i-1), 744.00,
    CASE WHEN i <= 22 THEN 'PAGADO' ELSE 'PAGADO' END);
END LOOP;

-- Crédito nuevo: $17,000, 25d, 24%, pago=843.20, adelantado=843.20
-- desembolso = 17000 - (744*3) - 0 - 843.20 = 17000 - 2232 - 843.20 = 13924.80
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c1, v_asesor1, v_suc,
  17000, 17000, 17000,
  0.2400, 4080, 21080, 843.20,
  25, 'DIARIO', 843.20,
  'Licuadora industrial y vitrina de exhibición',
  '2026-04-14', '2026-05-14',
  '2026-04-14 10:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn1;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn1, i, '2026-04-14'::date + (i-1), 843.20, 'PENDIENTE');
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, garantia_descripcion, created_by
) VALUES (
  v_ca1, v_cn1, v_c1, v_asesor1,
  '2026-04-14', 3, 2232.00,
  0.00, 843.20, 13924.80,
  'RUTA', 'Licuadora industrial y vitrina de exhibición', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-2: José Martínez — $10,000 → $12,000 — Mar 14 abr — CAJA
-- ──────────────────────────────────────────────────────────────
-- Anterior: $10,000, 25d, 30%, pago=520, 2 pendientes
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c2, v_asesor2, v_suc,
  10000, 10000, 10000,
  0.3000, 3000, 13000, 520.00,
  25, 'DIARIO', 520.00,
  'Herramientas de taller',
  '2026-03-12', '2026-04-12',
  '2026-03-12 08:30:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca2;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca2, i, '2026-03-12'::date + (i-1), 520.00, 'PAGADO');
END LOOP;

-- Nuevo: $12,000, 25d, 30%, pago=624, adelantado=624
-- desembolso = 12000 - (520*2) - 0 - 624 = 12000 - 1040 - 624 = 10336
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c2, v_asesor2, v_suc,
  12000, 12000, 12000,
  0.3000, 3600, 15600, 624.00,
  25, 'DIARIO', 624.00,
  'Herramientas de taller',
  '2026-04-14', '2026-05-14',
  '2026-04-14 09:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn2;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn2, i, '2026-04-14'::date + (i-1), 624.00, 'PENDIENTE');
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, garantia_descripcion, created_by
) VALUES (
  v_ca2, v_cn2, v_c2, v_asesor2,
  '2026-04-14', 2, 1040.00,
  0.00, 624.00, 10336.00,
  'CAJA', 'Herramientas de taller', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-3: Ana López — $20,000 → $22,000 — Mié 15 abr — RUTA
-- ──────────────────────────────────────────────────────────────
-- Anterior: $20,000, 30d, 24%, pago=800, 4 pendientes
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c3, v_asesor1, v_suc,
  20000, 20000, 20000,
  0.2400, 4800, 24800, 826.67,
  30, 'DIARIO', 826.67,
  'Silla de estética profesional y espejo',
  '2026-03-08', '2026-04-12',
  '2026-03-08 10:00:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca3;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca3, i, '2026-03-08'::date + (i-1), 826.67, 'PAGADO');
END LOOP;

-- Nuevo: $22,000, 30d, 24%, pago=909.33, adelantado=909.33
-- desembolso = 22000 - (826.67*4) - 0 - 909.33 = 22000 - 3306.68 - 909.33 = 17783.99
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c3, v_asesor1, v_suc,
  22000, 22000, 22000,
  0.2400, 5280, 27280, 909.33,
  30, 'DIARIO', 909.33,
  'Silla de estética profesional y espejo',
  '2026-04-15', '2026-05-19',
  '2026-04-15 10:30:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn3;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn3, i, '2026-04-15'::date + (i-1), 909.33, 'PENDIENTE');
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, garantia_descripcion, created_by
) VALUES (
  v_ca3, v_cn3, v_c3, v_asesor1,
  '2026-04-15', 4, 3306.68,
  0.00, 909.33, 17783.99,
  'RUTA', 'Silla de estética profesional y espejo', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-4: Pedro Ramírez — $15,000 → $15,000 — Jue 16 abr — RUTA
-- (renovación al mismo monto, 1 pago pendiente + multa $50)
-- ──────────────────────────────────────────────────────────────
-- Anterior: $15,000, 25d, 24%, pago=744, 1 pendiente
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c4, v_asesor2, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  'Refrigerador de vitrina para carnes',
  '2026-03-16', '2026-04-14',
  '2026-03-16 08:00:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca4;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca4, i, '2026-03-16'::date + (i-1), 744.00, 'PAGADO');
END LOOP;

-- Nuevo: $15,000, 25d, 24%, pago=744, adelantado=744
-- desembolso = 15000 - (744*1) - 50 - 744 = 15000 - 744 - 50 - 744 = 13462
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c4, v_asesor2, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  'Refrigerador de vitrina para carnes',
  '2026-04-16', '2026-05-16',
  '2026-04-16 09:15:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn4;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn4, i, '2026-04-16'::date + (i-1), 744.00, 'PENDIENTE');
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, garantia_descripcion, created_by
) VALUES (
  v_ca4, v_cn4, v_c4, v_asesor2,
  '2026-04-16', 1, 744.00,
  50.00, 744.00, 13462.00,
  'RUTA', 'Refrigerador de vitrina para carnes', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-5: Lucía Torres — $12,000 → $14,000 — Vie 18 abr — CAJA
-- ──────────────────────────────────────────────────────────────
-- Anterior: $12,000, 25d, 30%, pago=624, 2 pendientes
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c5, v_asesor1, v_suc,
  12000, 12000, 12000,
  0.3000, 3600, 15600, 624.00,
  25, 'DIARIO', 624.00,
  'Utensilios de cocina y tanque de gas',
  '2026-03-19', '2026-04-17',
  '2026-03-19 09:30:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca5;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca5, i, '2026-03-19'::date + (i-1), 624.00, 'PAGADO');
END LOOP;

-- Nuevo: $14,000, 25d, 30%, pago=728, adelantado=728
-- desembolso = 14000 - (624*2) - 0 - 728 = 14000 - 1248 - 728 = 12024
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c5, v_asesor1, v_suc,
  14000, 14000, 14000,
  0.3000, 4200, 18200, 728.00,
  25, 'DIARIO', 728.00,
  'Utensilios de cocina y tanque de gas',
  '2026-04-18', '2026-05-18',
  '2026-04-18 10:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn5;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn5, i, '2026-04-18'::date + (i-1), 728.00, 'PENDIENTE');
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, garantia_descripcion, created_by
) VALUES (
  v_ca5, v_cn5, v_c5, v_asesor1,
  '2026-04-18', 2, 1248.00,
  0.00, 728.00, 12024.00,
  'CAJA', 'Utensilios de cocina y tanque de gas', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- NUEVO-1: Roberto Flores — crédito nuevo $15,000 — Mar 15 abr
-- ──────────────────────────────────────────────────────────────
-- desembolso = 15000 - 744 (adelantado) = 14256
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c6, v_asesor2, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  'Estantes metálicos para bodega',
  '2026-04-15', '2026-05-15',
  '2026-04-15 08:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cnv1;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cnv1, i, '2026-04-15'::date + (i-1), 744.00, 'PENDIENTE');
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- NUEVO-2: Sofía Herrera — crédito nuevo $10,000 — Jue 17 abr
-- ──────────────────────────────────────────────────────────────
-- desembolso = 10000 - 520 = 9480
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c7, v_asesor1, v_suc,
  10000, 10000, 10000,
  0.3000, 3000, 13000, 520.00,
  25, 'DIARIO', 520.00,
  'Estantería y silla de cómputo',
  '2026-04-17', '2026-05-17',
  '2026-04-17 09:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cnv2;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cnv2, i, '2026-04-17'::date + (i-1), 520.00, 'PENDIENTE');
END LOOP;


-- ════════════════════════════════════════════════════════════════
-- CRÉDITOS Y RENOVACIONES — SEMANA ANTERIOR
-- lun 06 abr a vie 10 abr 2026
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- REN-6: Elena Vega — $15,000 → $17,000 — Mar 07 abr — RUTA
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c8, v_asesor1, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  '2026-03-03', '2026-04-02',
  '2026-03-03 09:00:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca8;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca8, i, '2026-03-03'::date + (i-1), 744.00, 'PAGADO');
END LOOP;

INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c8, v_asesor1, v_suc,
  17000, 17000, 17000,
  0.2400, 4080, 21080, 843.20,
  25, 'DIARIO', 843.20,
  '2026-04-07', '2026-05-07',
  '2026-04-07 10:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn8;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn8, i, '2026-04-07'::date + (i-1), 843.20,
    CASE WHEN i <= 9 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, created_by
) VALUES (
  v_ca8, v_cn8, v_c8, v_asesor1,
  '2026-04-07', 3, 2232.00,
  0.00, 843.20, 13924.80,
  'RUTA', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-7: Miguel Ortiz — $20,000 → $20,000 — Mié 08 abr — RUTA
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c9, v_asesor2, v_suc,
  20000, 20000, 20000,
  0.2400, 4800, 24800, 826.67,
  30, 'DIARIO', 826.67,
  '2026-03-02', '2026-04-05',
  '2026-03-02 08:30:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca9;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca9, i, '2026-03-02'::date + (i-1), 826.67, 'PAGADO');
END LOOP;

INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c9, v_asesor2, v_suc,
  20000, 20000, 20000,
  0.2400, 4800, 24800, 826.67,
  30, 'DIARIO', 826.67,
  '2026-04-08', '2026-05-12',
  '2026-04-08 09:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn9;

FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn9, i, '2026-04-08'::date + (i-1), 826.67,
    CASE WHEN i <= 9 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, created_by
) VALUES (
  v_ca9, v_cn9, v_c9, v_asesor2,
  '2026-04-08', 2, 1653.34,
  0.00, 826.67, 17519.99,
  'RUTA', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- REN-8: Carmen Reyes — $10,000 → $12,000 — Vie 10 abr — CAJA
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c10, v_asesor1, v_suc,
  10000, 10000, 10000,
  0.3000, 3000, 13000, 520.00,
  25, 'DIARIO', 520.00,
  '2026-03-05', '2026-04-04',
  '2026-03-05 09:00:00-06',
  'RENOVADO', v_admin
) RETURNING id INTO v_ca10;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_ca10, i, '2026-03-05'::date + (i-1), 520.00, 'PAGADO');
END LOOP;

INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c10, v_asesor1, v_suc,
  12000, 12000, 12000,
  0.3000, 3600, 15600, 624.00,
  25, 'DIARIO', 624.00,
  '2026-04-10', '2026-05-10',
  '2026-04-10 10:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cn10;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cn10, i, '2026-04-10'::date + (i-1), 624.00,
    CASE WHEN i <= 7 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

INSERT INTO renovaciones (
  credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
  fecha, pagos_restantes, monto_pagos_restantes,
  multas_pendientes, pago_adelantado, monto_desembolso,
  salida_de, created_by
) VALUES (
  v_ca10, v_cn10, v_c10, v_asesor1,
  '2026-04-10', 1, 520.00,
  0.00, 624.00, 10856.00,
  'CAJA', v_admin
);

-- ──────────────────────────────────────────────────────────────
-- NUEVO-3: Tomás Luna — $15,000 — Lun 06 abr
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c11, v_asesor2, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  '2026-04-06', '2026-05-06',
  '2026-04-06 08:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cnv8;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cnv8, i, '2026-04-06'::date + (i-1), 744.00,
    CASE WHEN i <= 11 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- NUEVO-4: Daniela Medina — $12,000 — Jue 09 abr
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c12, v_asesor1, v_suc,
  12000, 12000, 12000,
  0.3000, 3600, 15600, 624.00,
  25, 'DIARIO', 624.00,
  '2026-04-09', '2026-05-09',
  '2026-04-09 09:30:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cnv9;

FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cnv9, i, '2026-04-09'::date + (i-1), 624.00,
    CASE WHEN i <= 8 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;


-- ════════════════════════════════════════════════════════════════
-- CLIENTES ELEGIBLES PARA RENOVAR (TabNuevaRenovacion)
-- Créditos ACTIVO con 18+ pagos realizados — buscarlos por nombre
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- Isabel Cruz — $15,000, inicio 2026-03-12, 18 pagos realizados
-- Búscala como "Isabel" en el buscador del formulario
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c13, v_asesor1, v_suc,
  15000, 15000, 15000,
  0.2400, 3600, 18600, 744.00,
  25, 'DIARIO', 744.00,
  'Estufa industrial de 6 quemadores',
  '2026-03-12', '2026-04-11',
  '2026-03-12 08:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cd13;

-- 18 pagos PAGADO, 7 PENDIENTE (18 >= 16, elegible para renovar)
FOR i IN 1..25 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cd13, i, '2026-03-12'::date + (i-1), 744.00,
    CASE WHEN i <= 18 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

-- ──────────────────────────────────────────────────────────────
-- Ramón Castillo — $20,000, inicio 2026-03-08, 22 pagos realizados
-- Búscalo como "Ramón" en el buscador del formulario
-- ──────────────────────────────────────────────────────────────
INSERT INTO creditos (
  cliente_id, asesor_id, sucursal_id,
  monto_solicitado, monto_capital, monto_aprobado,
  tasa_interes, cargo_financiero, total_a_pagar, pago_periodico,
  plazo_dias, tipo_pago, pago_adelantado,
  garantia_descripcion,
  fecha_inicio, fecha_vencimiento, fecha_desembolso,
  estado, created_by
) VALUES (
  v_c14, v_asesor2, v_suc,
  20000, 20000, 20000,
  0.2400, 4800, 24800, 826.67,
  30, 'DIARIO', 826.67,
  'Maquinaria para corte de cuero',
  '2026-03-08', '2026-04-12',
  '2026-03-08 09:00:00-06',
  'ACTIVO', v_admin
) RETURNING id INTO v_cd14;

-- 22 pagos PAGADO, 8 PENDIENTE (22 >= 19 (umbral 30d), elegible)
FOR i IN 1..30 LOOP
  INSERT INTO calendario_pagos (credito_id, numero_pago, fecha_programada, monto_esperado, estado)
  VALUES (v_cd14, i, '2026-03-08'::date + (i-1), 826.67,
    CASE WHEN i <= 22 THEN 'PAGADO' ELSE 'PENDIENTE' END);
END LOOP;

RAISE NOTICE '✓ Seed completado exitosamente:';
RAISE NOTICE '  - 1 sucursal | 3 usuarios (admin@magno.mx, carlos@magno.mx, laura@magno.mx)';
RAISE NOTICE '  - 14 clientes | 26 créditos | 5 renovaciones semana actual | 3 semana anterior';
RAISE NOTICE '  - 2 clientes listos para renovar: Isabel Cruz y Ramón Castillo';
RAISE NOTICE '  Contraseña de todos los usuarios: password123';

END $$;
