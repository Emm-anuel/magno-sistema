-- =============================================================
-- MAGNO - V28: Sync identity sequences for all seeded tables
--
-- Development seeds insert rows with explicit IDs, leaving the
-- BIGSERIAL sequences behind the actual max id. This causes
-- duplicate primary key errors on the next application insert.
-- =============================================================

SELECT setval(pg_get_serial_sequence('creditos',          'id'), COALESCE((SELECT MAX(id) FROM creditos),          0) + 1, false);
SELECT setval(pg_get_serial_sequence('clientes',          'id'), COALESCE((SELECT MAX(id) FROM clientes),          0) + 1, false);
SELECT setval(pg_get_serial_sequence('pagos',             'id'), COALESCE((SELECT MAX(id) FROM pagos),             0) + 1, false);
SELECT setval(pg_get_serial_sequence('calendario_pagos',  'id'), COALESCE((SELECT MAX(id) FROM calendario_pagos),  0) + 1, false);
SELECT setval(pg_get_serial_sequence('multas',            'id'), COALESCE((SELECT MAX(id) FROM multas),            0) + 1, false);
SELECT setval(pg_get_serial_sequence('renovaciones',      'id'), COALESCE((SELECT MAX(id) FROM renovaciones),      0) + 1, false);
SELECT setval(pg_get_serial_sequence('usuarios',          'id'), COALESCE((SELECT MAX(id) FROM usuarios),          0) + 1, false);
SELECT setval(pg_get_serial_sequence('sucursales',        'id'), COALESCE((SELECT MAX(id) FROM sucursales),        0) + 1, false);
