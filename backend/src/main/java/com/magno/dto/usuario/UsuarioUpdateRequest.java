package com.magno.dto.usuario;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UsuarioUpdateRequest(

        @NotBlank(message = "nombreCompleto no debe estar vacío")
        String nombreCompleto,

        @NotBlank(message = "telefono no debe estar vacío")
        String telefono,

        @NotBlank(message = "rol no debe estar vacío")
        String rol,

        @NotNull(message = "sucursalId no debe ser nulo")
        Long sucursalId,

        // Domicilio
        @NotBlank(message = "calle no debe estar vacía") String calle,
        @NotBlank(message = "noExterior no debe estar vacío") String noExterior,
        String noInterior,
        @NotBlank(message = "colonia no debe estar vacía") String colonia,
        @NotBlank(message = "municipio no debe estar vacío") String municipio,
        @NotBlank(message = "estado no debe estar vacío") String estado,
        @NotBlank(message = "codigoPostal no debe estar vacío") String codigoPostal,

        // Identificación
        @NotBlank(message = "ineNumero no debe estar vacío") String ineNumero,
        @NotBlank(message = "ineImagenUrl no debe estar vacÃ­o") String ineImagenUrl,
        @NotBlank(message = "ineImagenReversoUrl no debe estar vacÃ­o") String ineImagenReversoUrl,

        // Referencias
        @NotBlank(message = "ref1Nombre no debe estar vacío") String ref1Nombre,
        @NotBlank(message = "ref1Telefono no debe estar vacío") String ref1Telefono,
        @NotBlank(message = "ref1Parentesco no debe estar vacío") String ref1Parentesco,
        @NotBlank(message = "ref2Nombre no debe estar vacío") String ref2Nombre,
        @NotBlank(message = "ref2Telefono no debe estar vacío") String ref2Telefono,
        @NotBlank(message = "ref2Parentesco no debe estar vacío") String ref2Parentesco,

        /** Nueva contraseña. Si es null/blank, no se cambia. */
        @Size(min = 6, message = "password debe tener al menos 6 caracteres")
        String password
) {}
