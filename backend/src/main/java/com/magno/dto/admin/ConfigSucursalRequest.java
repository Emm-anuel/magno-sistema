package com.magno.dto.admin;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ConfigSucursalRequest(
        @NotNull LocalTime horaLimiteOperacion,
        @NotNull @DecimalMin("0.00") @DecimalMax("1.00") BigDecimal porcentajeAhorro,
        @NotNull @DecimalMin("0.00") BigDecimal montoAhorroFijo,
        @NotBlank String diaPagoNomina
) {}
