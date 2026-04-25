package com.magno.dto.gasto;

public record CategoriaGastoDTO(
        Long id,
        Long sucursalId,
        String nombre,
        String descripcion
) {}
