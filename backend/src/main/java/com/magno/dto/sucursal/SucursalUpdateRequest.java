package com.magno.dto.sucursal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SucursalUpdateRequest(
        @NotBlank(message = "nombre no debe estar vacío") @Size(max = 100, message = "nombre excede 100 caracteres") String nombre,

        @Size(max = 255, message = "direccion excede 255 caracteres") String direccion,

        @Pattern(regexp = "^$|\\d{10}", message = "telefono debe tener exactamente 10 dígitos") String telefono) {
}
