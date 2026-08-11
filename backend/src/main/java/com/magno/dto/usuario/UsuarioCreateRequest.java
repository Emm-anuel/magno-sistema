package com.magno.dto.usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import java.time.LocalDate;

public record UsuarioCreateRequest(

        @NotBlank(message = "nombreCompleto no debe estar vacío")
        String nombreCompleto,

        @NotBlank(message = "email no debe estar vacío")
        @Email(message = "email debe ser una dirección de correo válida")
        String email,

        @NotBlank(message = "password no debe estar vacío")
        @Size(min = 6, message = "password debe tener al menos 6 caracteres")
        String password,

        @NotBlank(message = "telefono no debe estar vacío")
        @Pattern(regexp = "\\d{10}", message = "telefono debe tener exactamente 10 dígitos")
        String telefono,

        @NotNull(message = "fechaNacimiento no debe ser nula")
        @Past(message = "fechaNacimiento debe ser anterior a hoy")
        LocalDate fechaNacimiento,

        @NotNull(message = "fechaIngreso no debe ser nula")
        @PastOrPresent(message = "fechaIngreso no puede ser futura")
        LocalDate fechaIngreso,

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
        @NotBlank(message = "ref1Telefono no debe estar vacío")
        @Pattern(regexp = "\\d{10}", message = "ref1Telefono debe tener exactamente 10 dígitos") String ref1Telefono,
        @NotBlank(message = "ref1Parentesco no debe estar vacío") String ref1Parentesco,
        @NotBlank(message = "ref2Nombre no debe estar vacío") String ref2Nombre,
        @NotBlank(message = "ref2Telefono no debe estar vacío")
        @Pattern(regexp = "\\d{10}", message = "ref2Telefono debe tener exactamente 10 dígitos") String ref2Telefono,
        @NotBlank(message = "ref2Parentesco no debe estar vacío") String ref2Parentesco
) {}
