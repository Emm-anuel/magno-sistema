package com.magno.dto.gasto;

import jakarta.validation.constraints.*;

public record CategoriaGastoUpsertRequest(
        @NotBlank @Size(max = 150) String nombre,
        String descripcion
) {}
