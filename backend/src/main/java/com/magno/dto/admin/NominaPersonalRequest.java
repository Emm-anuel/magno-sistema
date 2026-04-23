package com.magno.dto.admin;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record NominaPersonalRequest(
        @NotBlank String nombre,
        @NotBlank String puesto,
        @NotNull @DecimalMin("0.01") BigDecimal montoSemanal
) {}
