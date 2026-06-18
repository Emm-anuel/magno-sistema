package com.magno.dto.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

/** Reemplaza TODOS los rangos de multa de la sucursal. */
public record ConfigMultaListRequest(
        @NotEmpty List<@Valid MultaItem> multas
) {
    public record MultaItem(
            @NotNull @DecimalMin("0.00") BigDecimal rangoMin,
            @NotNull @DecimalMin("0.01") BigDecimal rangoMax,
            @NotNull @DecimalMin("0.00") BigDecimal multaNoPago,
            @NotNull @DecimalMin("0.00") BigDecimal multaIncompletos,
            @NotNull @DecimalMin("0.00") BigDecimal multaSemanalNoPago,
            @NotNull @DecimalMin("0.00") BigDecimal multaSemanalIncompletos
    ) {}
}
