package com.magno.dto.caja;

import java.math.BigDecimal;

public record CobroAsesorItemDTO(
        String asesorNombre,
        int cantidadCobros,
        BigDecimal montoCobrado
) {}
