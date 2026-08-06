package com.magno.dto.usuario;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record SucursalesAdicionalesRequest(
        @NotNull(message = "sucursalIds no debe ser nulo")
        List<Long> sucursalIds
) {}
