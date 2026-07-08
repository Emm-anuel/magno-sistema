ALTER TABLE calendario_pagos
    DROP CONSTRAINT IF EXISTS calendario_pagos_estado_check;

ALTER TABLE calendario_pagos
    ADD CONSTRAINT calendario_pagos_estado_check
    CHECK (estado IN (
        'PENDIENTE',
        'PAGADO',
        'NO_PAGADO',
        'PARCIAL',
        'ADELANTADO',
        'RECUPERADO',
        'RECUPERADO_PARCIAL'
    ));
