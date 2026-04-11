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
        String telefonoFijo,

        @Pattern(regexp = "\\d{10}", message = "celular debe tener 10 dígitos")
        String celular,

        // Identificación
        String ineTipo,
        String ineNumero,

        @Size(min = 18, max = 18, message = "curp debe tener exactamente 18 caracteres")
        String curp,

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
        String negocioTipoLocal,
        BigDecimal negocioMontoRenta,
        String negocioHorarios,

        // Finanzas
        BigDecimal ingresosSemanales,
        BigDecimal gastosSemanales,
        BigDecimal gastosRenta,
        BigDecimal gastosOtros,

        // Referencias
        String ref1Nombre,
        String ref1Telefono,
        String ref1Parentesco,
        String ref2Nombre,
        String ref2Telefono,
        String ref2Parentesco,

        // Aval
        String avalNombre,
        String avalTelefono,
        String avalDireccion,
        String avalIdentificacion,

        // Asignación
        Long asesorId,
        Long sucursalId
) {}
