-- =============================================================
-- V8: Tabla de documentos del cliente (INE, comprobante, etc.)
-- =============================================================

CREATE TABLE IF NOT EXISTS cliente_documentos (
    id          BIGSERIAL PRIMARY KEY,
    cliente_id  BIGINT NOT NULL REFERENCES clientes(id),
    tipo        VARCHAR(30) NOT NULL,
    url         VARCHAR(500) NOT NULL,
    nombre      VARCHAR(150),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  BIGINT REFERENCES usuarios(id),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente
    ON cliente_documentos(cliente_id)
    WHERE deleted_at IS NULL;
