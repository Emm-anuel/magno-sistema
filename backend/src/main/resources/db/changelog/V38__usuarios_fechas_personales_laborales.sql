ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

COMMENT ON COLUMN usuarios.fecha_nacimiento IS 'Fecha de nacimiento del usuario';
COMMENT ON COLUMN usuarios.fecha_ingreso IS 'Fecha en que el usuario ingresó a la empresa';
