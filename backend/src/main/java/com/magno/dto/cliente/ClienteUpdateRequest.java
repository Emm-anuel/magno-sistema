package com.magno.dto.cliente;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Campos editables de un cliente (todos opcionales para soporte PATCH parcial).
 */
public record ClienteUpdateRequest(

        // Datos personales
        String nombre,
        String apellidoPaterno,
        String apellidoMaterno,
        LocalDate fechaNacimiento,
        String genero,
        String estadoCivil,
        String nombreConyuge,
        @Pattern(regexp = "^$|\\d{10}", message = "telefonoFijo debe tener exactamente 10 dígitos")
        String telefonoFijo,

        @Pattern(regexp = "\\d{10}", message = "celular debe tener exactamente 10 dígitos")
        String celular,

        // Identificación
        String ineTipo,
        String ineNumero,

        @Size(min = 18, max = 18, message = "curp debe tener exactamente 18 caracteres")
        @Pattern(regexp = "[A-Za-z0-9]{18}", message = "curp solo puede contener letras y números")
        String curp,

        @Pattern(regexp = "^$|[A-Za-z0-9Ññ&]{12,13}", message = "rfc debe tener 12 o 13 caracteres válidos")
        String rfc,

        // Domicilio
        String domCalle,
        String domNoExterior,
        String domNoInterior,
        String domColonia,
        String domMunicipio,
        String domEstado,
        String domCodigoPostal,
        String domTipoVivienda,
        BigDecimal domMontoRenta,

        // Negocio
        String negocioNombre,
        String negocioGiro,
        String negocioAntiguedad,
        String negocioDireccion,
        // Dirección del negocio en campos separados (todos opcionales en update)
        String negocioCalle,
        String negocioNoExterior,
        String negocioNoInterior,
        String negocioColonia,
        String negocioMunicipio,
        String negocioEstado,
        String negocioCp,
        String negocioTipoLocal,
        BigDecimal negocioMontoRenta,
        String negocioHorarios,
        BigDecimal negocioLat,
        BigDecimal negocioLng,

        // Finanzas
        BigDecimal ingresosSemanales,
        BigDecimal gastosSemanales,
        BigDecimal gastosRenta,
        BigDecimal gastosOtros,

        // Referencias
        String ref1Nombre,
        @Pattern(regexp = "^$|\\d{10}", message = "ref1Telefono debe tener exactamente 10 dígitos")
        String ref1Telefono,
        String ref1Parentesco,
        String ref2Nombre,
        @Pattern(regexp = "^$|\\d{10}", message = "ref2Telefono debe tener exactamente 10 dígitos")
        String ref2Telefono,
        String ref2Parentesco,

        // Aval
        String avalNombre,
        @Pattern(regexp = "^$|\\d{10}", message = "avalTelefono debe tener exactamente 10 dígitos")
        String avalTelefono,
        String avalDireccion,
        String avalIdentificacion,

        // Asignación
        Long asesorId,
        Long sucursalId
) {}
