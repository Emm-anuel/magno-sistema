-- ============================================================
-- PARTE 1: Sucursales, Usuarios, Config Multas
-- Deja IDs en tabla temporal magno_seed_ids para Partes 2 y 3.
-- ============================================================

-- Tabla temporal de IDs (persiste en sesión)
CREATE TEMP TABLE IF NOT EXISTS magno_seed_ids (
  clave  TEXT PRIMARY KEY,
  val    BIGINT NOT NULL
);

DO $$
DECLARE
  v_suc_centro BIGINT;
  v_suc_norte  BIGINT;
  v_suc_sur    BIGINT;
  v_admin      BIGINT;
  v_gte_cen    BIGINT;
  v_sup_cen    BIGINT;
  v_ase_c1     BIGINT;
  v_ase_c2     BIGINT;
  v_ase_c3     BIGINT;
  v_gte_nor    BIGINT;
  v_sup_nor    BIGINT;
  v_ase_n1     BIGINT;
  v_ase_n2     BIGINT;
  v_gte_sur    BIGINT;
  v_sup_sur    BIGINT;
  v_ase_s1     BIGINT;
  v_ase_s2     BIGINT;
  -- BCrypt hash de "password123"
  v_hash CONSTANT TEXT := '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
BEGIN

-- ────────────────────────────────────────────────────────────────
-- 1. SUCURSALES
-- ────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = 'Centro') THEN
  INSERT INTO sucursales (nombre, direccion, telefono, multa_base, ahorro_diario, activa)
  VALUES ('Centro', 'Av. Hidalgo 100, Centro, Pachuca', '7712000001', 50.00, 2000.00, TRUE)
  RETURNING id INTO v_suc_centro;
ELSE
  SELECT id INTO v_suc_centro FROM sucursales WHERE nombre = 'Centro';
END IF;

IF NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = 'Norte') THEN
  INSERT INTO sucursales (nombre, direccion, telefono, multa_base, ahorro_diario, activa)
  VALUES ('Norte', 'Blvd. Norte 450, Col. Industrial, Pachuca', '7712000010', 50.00, 2000.00, TRUE)
  RETURNING id INTO v_suc_norte;
ELSE
  SELECT id INTO v_suc_norte FROM sucursales WHERE nombre = 'Norte';
END IF;

IF NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = 'Sur') THEN
  INSERT INTO sucursales (nombre, direccion, telefono, multa_base, ahorro_diario, activa)
  VALUES ('Sur', 'Calle Morelos 88, Col. Los Pinos, Mineral de la Reforma', '7712000020', 50.00, 2000.00, TRUE)
  RETURNING id INTO v_suc_sur;
ELSE
  SELECT id INTO v_suc_sur FROM sucursales WHERE nombre = 'Sur';
END IF;

-- ────────────────────────────────────────────────────────────────
-- 2. USUARIOS
-- Rol: ADMINISTRADOR → "Gerente General"
--      SUPERVISOR → "Gerente de Sucursal"
--      SUPERVISOR_CAMPO → "Supervisor"
--      ASESOR_COBRADOR → "Asesor"
-- ────────────────────────────────────────────────────────────────

-- Gerente General (acceso total, todas las sucursales)
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Gerente General Demo', 'admin@magno.mx', v_hash, '7712000002',
  (SELECT id FROM roles WHERE nombre='ADMINISTRADOR'), v_suc_centro,
  'Calle Central','1','Centro','Pachuca','Hidalgo','42000','ADM-GEN-001',
  'Referencia Admin 1','7711000001','Familiar','Referencia Admin 2','7711000002','Familiar'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='admin@magno.mx');
SELECT id INTO v_admin FROM usuarios WHERE email='admin@magno.mx';

-- Gerente Sucursal Centro
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Patricia Guerrero Soto', 'gerente.centro@magno.mx', v_hash, '7712000003',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR'), v_suc_centro,
  'Av. Juárez','10','Col. Centro','Pachuca','Hidalgo','42001','GTE-CEN-001',
  'Hermana Guerrero','7711000003','Hermana','Esposo Guerrero','7711000004','Cónyuge'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='gerente.centro@magno.mx');
SELECT id INTO v_gte_cen FROM usuarios WHERE email='gerente.centro@magno.mx';

-- Supervisor Centro (campo)
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Marcos Delgado Ríos', 'supervisor.centro@magno.mx', v_hash, '7712000004',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR_CAMPO'), v_suc_centro,
  'Calle Reforma','25','Col. Morelos','Pachuca','Hidalgo','42002','SUP-CEN-001',
  'Madre Delgado','7711000005','Madre','Vecino Delgado','7711000006','Vecino'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='supervisor.centro@magno.mx');
SELECT id INTO v_sup_cen FROM usuarios WHERE email='supervisor.centro@magno.mx';

-- Asesor Centro 1 — Carlos Mendoza (el que tiene clientes en todos los estados)
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Carlos Mendoza López', 'carlos@magno.mx', v_hash, '7712000005',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_centro,
  'Av. Juárez','45','Col. San Francisco','Pachuca','Hidalgo','42010','ASE-C1-001',
  'Esposa Mendoza','7711000007','Cónyuge','Hermano Mendoza','7711000008','Hermano'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='carlos@magno.mx');
SELECT id INTO v_ase_c1 FROM usuarios WHERE email='carlos@magno.mx';

-- Asesor Centro 2 — Laura Sánchez
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Laura Sánchez Ruiz', 'laura@magno.mx', v_hash, '7712000006',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_centro,
  'Blvd. Valle','22','Col. Valle Grande','Pachuca','Hidalgo','42020','ASE-C2-001',
  'Madre Sánchez','7711000009','Madre','Padre Sánchez','7711000010','Padre'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='laura@magno.mx');
SELECT id INTO v_ase_c2 FROM usuarios WHERE email='laura@magno.mx';

-- Asesor Centro 3 — Diego Reyes
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Diego Reyes Contreras', 'diego@magno.mx', v_hash, '7712000007',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_centro,
  'Calle Zaragoza','8','Col. Las Flores','Pachuca','Hidalgo','42030','ASE-C3-001',
  'Hermana Reyes','7711000011','Hermana','Amigo Reyes','7711000012','Amigo'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='diego@magno.mx');
SELECT id INTO v_ase_c3 FROM usuarios WHERE email='diego@magno.mx';

-- Gerente Sucursal Norte
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Ricardo Vega Espinoza', 'gerente.norte@magno.mx', v_hash, '7712000011',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR'), v_suc_norte,
  'Calle Industria','12','Col. Industrial','Pachuca','Hidalgo','42100','GTE-NOR-001',
  'Esposa Vega','7711000013','Cónyuge','Hijo Vega','7711000014','Hijo'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='gerente.norte@magno.mx');
SELECT id INTO v_gte_nor FROM usuarios WHERE email='gerente.norte@magno.mx';

-- Supervisor Norte
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Claudia Flores Nava', 'supervisor.norte@magno.mx', v_hash, '7712000012',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR_CAMPO'), v_suc_norte,
  'Priv. Cedros','3','Col. Cedros','Pachuca','Hidalgo','42101','SUP-NOR-001',
  'Madre Flores','7711000015','Madre','Hermana Flores','7711000016','Hermana'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='supervisor.norte@magno.mx');
SELECT id INTO v_sup_nor FROM usuarios WHERE email='supervisor.norte@magno.mx';

-- Asesor Norte 1
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Fernando Ortega Cruz', 'fernando.n@magno.mx', v_hash, '7712000013',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_norte,
  'Calle Pinos','18','Col. Los Pinos','Pachuca','Hidalgo','42102','ASE-N1-001',
  'Esposa Ortega','7711000017','Cónyuge','Vecino Ortega','7711000018','Vecino'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='fernando.n@magno.mx');
SELECT id INTO v_ase_n1 FROM usuarios WHERE email='fernando.n@magno.mx';

-- Asesor Norte 2
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Adriana Luna Pérez', 'adriana.n@magno.mx', v_hash, '7712000014',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_norte,
  'Calle Nogales','7','Col. Jardines','Pachuca','Hidalgo','42103','ASE-N2-001',
  'Madre Luna','7711000019','Madre','Hermano Luna','7711000020','Hermano'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='adriana.n@magno.mx');
SELECT id INTO v_ase_n2 FROM usuarios WHERE email='adriana.n@magno.mx';

-- Gerente Sucursal Sur
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Sandra Morales Trejo', 'gerente.sur@magno.mx', v_hash, '7712000021',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR'), v_suc_sur,
  'Av. Constitución','55','Col. Centro','Mineral de la Reforma','Hidalgo','42180','GTE-SUR-001',
  'Esposo Morales','7711000021','Cónyuge','Madre Morales','7711000022','Madre'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='gerente.sur@magno.mx');
SELECT id INTO v_gte_sur FROM usuarios WHERE email='gerente.sur@magno.mx';

-- Supervisor Sur
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Raúl Jiménez Salinas', 'supervisor.sur@magno.mx', v_hash, '7712000022',
  (SELECT id FROM roles WHERE nombre='SUPERVISOR_CAMPO'), v_suc_sur,
  'Calle Magnolias','14','Col. Jardines','Mineral de la Reforma','Hidalgo','42181','SUP-SUR-001',
  'Esposa Jiménez','7711000023','Cónyuge','Hermano Jiménez','7711000024','Hermano'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='supervisor.sur@magno.mx');
SELECT id INTO v_sup_sur FROM usuarios WHERE email='supervisor.sur@magno.mx';

-- Asesor Sur 1
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Norma Castillo Herrera', 'norma.s@magno.mx', v_hash, '7712000023',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_sur,
  'Priv. Robles','9','Col. El Roble','Mineral de la Reforma','Hidalgo','42182','ASE-S1-001',
  'Madre Castillo','7711000025','Madre','Vecina Castillo','7711000026','Vecina'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='norma.s@magno.mx');
SELECT id INTO v_ase_s1 FROM usuarios WHERE email='norma.s@magno.mx';

-- Asesor Sur 2
INSERT INTO usuarios (nombre_completo, email, password_hash, telefono,
  rol_id, sucursal_id, calle, no_exterior, colonia, municipio, estado, codigo_postal,
  ine_numero, ref1_nombre, ref1_telefono, ref1_parentesco, ref2_nombre, ref2_telefono, ref2_parentesco)
SELECT 'Humberto Silva Ramírez', 'humberto.s@magno.mx', v_hash, '7712000024',
  (SELECT id FROM roles WHERE nombre='ASESOR_COBRADOR'), v_suc_sur,
  'Calle Tulipanes','32','Col. Las Palmas','Mineral de la Reforma','Hidalgo','42183','ASE-S2-001',
  'Esposa Silva','7711000027','Cónyuge','Padre Silva','7711000028','Padre'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='humberto.s@magno.mx');
SELECT id INTO v_ase_s2 FROM usuarios WHERE email='humberto.s@magno.mx';

-- ────────────────────────────────────────────────────────────────
-- 3. CONFIG MULTAS (por sucursal)
-- Rango $1k-$14k: $50/día. Rango $15k+: $100/día
-- ────────────────────────────────────────────────────────────────

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_centro, 1000.00, 14999.99, 50.00, 50.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_centro AND rango_min = 1000.00);

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_centro, 15000.00, 50000.00, 100.00, 100.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_centro AND rango_min = 15000.00);

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_norte, 1000.00, 14999.99, 50.00, 50.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_norte AND rango_min = 1000.00);

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_norte, 15000.00, 50000.00, 100.00, 100.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_norte AND rango_min = 15000.00);

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_sur, 1000.00, 14999.99, 50.00, 50.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_sur AND rango_min = 1000.00);

INSERT INTO config_multas (sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos)
SELECT v_suc_sur, 15000.00, 50000.00, 100.00, 100.00
WHERE NOT EXISTS (SELECT 1 FROM config_multas WHERE sucursal_id = v_suc_sur AND rango_min = 15000.00);

-- ────────────────────────────────────────────────────────────────
-- 4. EXPORTAR IDs a tabla temporal
-- ────────────────────────────────────────────────────────────────

INSERT INTO magno_seed_ids VALUES
  ('suc_centro', v_suc_centro),
  ('suc_norte',  v_suc_norte),
  ('suc_sur',    v_suc_sur),
  ('admin',      v_admin),
  ('gte_cen',    v_gte_cen),
  ('sup_cen',    v_sup_cen),
  ('ase_c1',     v_ase_c1),
  ('ase_c2',     v_ase_c2),
  ('ase_c3',     v_ase_c3),
  ('gte_nor',    v_gte_nor),
  ('sup_nor',    v_sup_nor),
  ('ase_n1',     v_ase_n1),
  ('ase_n2',     v_ase_n2),
  ('gte_sur',    v_gte_sur),
  ('sup_sur',    v_sup_sur),
  ('ase_s1',     v_ase_s1),
  ('ase_s2',     v_ase_s2)
ON CONFLICT (clave) DO UPDATE SET val = EXCLUDED.val;

RAISE NOTICE '✓ Parte 1 completada: 3 sucursales, 13 usuarios, config multas';
RAISE NOTICE '  Logins disponibles:';
RAISE NOTICE '    admin@magno.mx          — Gerente General';
RAISE NOTICE '    gerente.centro@magno.mx — Gerente Sucursal Centro';
RAISE NOTICE '    supervisor.centro@magno.mx — Supervisor Centro';
RAISE NOTICE '    carlos@magno.mx / laura@magno.mx / diego@magno.mx — Asesores Centro';
RAISE NOTICE '    gerente.norte@magno.mx / gerente.sur@magno.mx';
RAISE NOTICE '  Contraseña todos: password123';

END $$;
