package com.magno.dto.caja;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AbrirCajaRequest(
        Long sucursalId,
        @NotNull BigDecimal montoApertura,
        String conceptoApertura
) {}
