package com.magno.dto.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Reemplaza TODOS los umbrales de la sucursal. */
public record ConfigUmbralRenovacionRequest(
        @NotEmpty List<@Valid UmbralItem> umbrales
) {
    public record UmbralItem(
            @NotNull String tipoPago,
            @NotNull @Min(1) Integer plazo,
            @NotNull @Min(1) Integer umbralPagos
    ) {}
}
