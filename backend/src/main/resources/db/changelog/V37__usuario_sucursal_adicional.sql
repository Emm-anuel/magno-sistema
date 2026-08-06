-- =============================================================
-- MAGNO — V37: Sucursales adicionales para el rol Supervisor
--
-- Permite que un usuario con rol SUPERVISOR_CAMPO opere/consulte,
-- además de en su sucursal home (usuarios.sucursal_id), en otras
-- sucursales que el Gerente General le asigne explícitamente.
-- =============================================================

CREATE TABLE usuario_sucursal_adicional (
    usuario_id   BIGINT NOT NULL REFERENCES usuarios(id),
    sucursal_id  BIGINT NOT NULL REFERENCES sucursales(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, sucursal_id)
);

CREATE INDEX idx_usuario_sucursal_adicional_usuario ON usuario_sucursal_adicional(usuario_id);
