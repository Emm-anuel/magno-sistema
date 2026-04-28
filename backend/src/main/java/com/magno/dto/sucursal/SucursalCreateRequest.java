package com.magno.dto.sucursal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SucursalCreateRequest(
        @NotBlank(message = "nombre no debe estar vacío") @Size(max = 100, message = "nombre excede 100 caracteres") String nombre,

        @Size(max = 255, message = "direccion excede 255 caracteres") String direccion,

        @Size(max = 20, message = "telefono excede 20 caracteres") String telefono) {
}
