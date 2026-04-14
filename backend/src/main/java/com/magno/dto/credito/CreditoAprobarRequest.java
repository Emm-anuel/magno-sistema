package com.magno.dto.credito;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreditoAprobarRequest(

        @NotNull(message = "El monto aprobado es requerido")
        @DecimalMin(value = "1000.00", message = "El monto mínimo es $1,000")
        BigDecimal montoAprobado,

        String observaciones
) {}
