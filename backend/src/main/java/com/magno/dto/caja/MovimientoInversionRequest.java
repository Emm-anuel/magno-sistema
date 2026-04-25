package com.magno.dto.caja;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record MovimientoInversionRequest(
        @NotNull Long conceptoInversionId,
        String descripcion,
        @NotNull BigDecimal monto
) {}
