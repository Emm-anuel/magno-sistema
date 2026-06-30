package com.magno.dto.renovacion;

import java.math.BigDecimal;
import java.util.List;

public record RenovacionAprobarRequest(
        BigDecimal montoAprobado,
        List<Long> multasCondonadasIds,
        String motivoCondonacion
) {}
