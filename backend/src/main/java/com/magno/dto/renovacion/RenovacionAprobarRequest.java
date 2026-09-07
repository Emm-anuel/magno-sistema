package com.magno.dto.renovacion;

import java.math.BigDecimal;
import java.util.List;

public record RenovacionAprobarRequest(
        BigDecimal montoAprobado,
        Integer plazo,
        List<Long> multasCondonadasIds,
        String motivoCondonacion
) {}
