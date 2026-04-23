package com.magno.dto.admin;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ConfigMultaAdminRequest(
        @NotNull @DecimalMin("0.00") BigDecimal rangoMin,
        @NotNull @DecimalMin("0.01") BigDecimal rangoMax,
        @NotNull @DecimalMin("0.00") BigDecimal multaNoPago,
        @NotNull @DecimalMin("0.00") BigDecimal multaIncompletos,
        @NotNull @DecimalMin("0.00") BigDecimal multaSemanalNoPago,
        @NotNull @DecimalMin("0.00") BigDecimal multaSemanalIncompletos
) {}
