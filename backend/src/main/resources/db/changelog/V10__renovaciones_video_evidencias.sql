-- =============================================================
-- MAGNO — Renovaciones: video de entrega y evidencias multimedia
-- Changeset: V10__renovaciones_video_evidencias.sql
-- Los campos video_entrega_url y evidencia_urls no estaban en V1
-- pero están definidos en docs/06-archivos-y-storage.md
-- =============================================================

ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS video_entrega_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS evidencia_urls TEXT[];
