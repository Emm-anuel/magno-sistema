-- =============================================================
-- MAGNO - V25: Sync caja_dia identity sequence
--
-- Some development/import flows can leave the BIGSERIAL sequence behind
-- existing caja_dia rows, causing duplicate primary keys on the next insert.
-- Keep the sequence aligned with the highest stored id.
-- =============================================================

SELECT setval(
    pg_get_serial_sequence('caja_dia', 'id'),
    COALESCE((SELECT MAX(id) FROM caja_dia), 0) + 1,
    false
);
