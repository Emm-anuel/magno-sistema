package com.magno.dto.caja;

import java.math.BigDecimal;

public record MultaAsesorItemDTO(
        String asesorNombre,
        BigDecimal totalMultas
) {}
