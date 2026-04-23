package com.magno.dto.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Reemplaza TODOS los rangos de un tipo de pago para la sucursal. */
public record ConfigRangoCreditoRequest(
        @NotEmpty List<@Valid RangoItem> diario,
        @NotEmpty List<@Valid RangoItem> semanal
) {
    public record RangoItem(
            @NotNull java.math.BigDecimal rangoMin,
            @NotNull java.math.BigDecimal rangoMax,
            @NotNull Integer plazo,
            @NotNull java.math.BigDecimal tasaInteres
    ) {}
}
