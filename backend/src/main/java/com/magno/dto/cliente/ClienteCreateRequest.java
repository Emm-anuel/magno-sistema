package com.magno.dto.cliente;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ClienteCreateRequest(

        // ── Datos personales ──────────────────────────────────────
        @NotBlank(message = "nombre no debe estar vacío")
        String nombre,

        @NotBlank(message = "apellidoPaterno no debe estar vacío")
        String apellidoPaterno,

        String apellidoMaterno,

        @NotNull(message = "fechaNacimiento no debe ser nula")
        LocalDate fechaNacimiento,

        String genero,

        @NotBlank(message = "estadoCivil no debe estar vacío")
        String estadoCivil,

        String nombreConyuge,
        String telefonoFijo,

        @NotBlank(message = "celular no debe estar vacío")
        @Pattern(regexp = "\\d{10}", message = "celular debe tener 10 dígitos")
        String celular,

        // ── Identificación ────────────────────────────────────────
        String ineTipo,

        @NotBlank(message = "ineNumero no debe estar vacío")
        String ineNumero,

        @NotBlank(message = "curp no debe estar vacía")
        @Size(min = 18, max = 18, message = "curp debe tener exactamente 18 caracteres")
        String curp,

        String rfc,

        // ── Domicilio ─────────────────────────────────────────────
        @NotBlank(message = "domCalle no debe estar vacía")
        String domCalle,

        @NotBlank(message = "domNoExterior no debe estar vacío")
        String domNoExterior,

        String domNoInterior,

        @NotBlank(message = "domColonia no debe estar vacía")
        String domColonia,

        @NotBlank(message = "domMunicipio no debe estar vacío")
        String domMunicipio,

        @NotBlank(message = "domEstado no debe estar vacío")
        String domEstado,

        @NotBlank(message = "domCodigoPostal no debe estar vacío")
        String domCodigoPostal,

        String domTipoVivienda,
        BigDecimal domMontoRenta,

        // ── Negocio ───────────────────────────────────────────────
        @NotBlank(message = "negocioNombre no debe estar vacío")
        String negocioNombre,

        @NotBlank(message = "negocioGiro no debe estar vacío")
        String negocioGiro,

        @NotBlank(message = "negocioAntiguedad no debe estar vacía")
        String negocioAntiguedad,

        String negocioDireccion,

        // Dirección del negocio en campos separados (obligatorios)
        @NotBlank(message = "negocioCalle no debe estar vacía")
        String negocioCalle,

        @NotBlank(message = "negocioNoExterior no debe estar vacío")
        String negocioNoExterior,

        String negocioNoInterior,

        @NotBlank(message = "negocioColonia no debe estar vacía")
        String negocioColonia,

        @NotBlank(message = "negocioMunicipio no debe estar vacío")
        String negocioMunicipio,

        @NotBlank(message = "negocioEstado no debe estar vacío")
        String negocioEstado,

        @NotBlank(message = "negocioCp no debe estar vacío")
        String negocioCp,

        String negocioTipoLocal,
        BigDecimal negocioMontoRenta,
        String negocioHorarios,
        BigDecimal negocioLat,
        BigDecimal negocioLng,

        // ── Finanzas ──────────────────────────────────────────────
        BigDecimal ingresosSemanales,
        BigDecimal gastosSemanales,
        BigDecimal gastosRenta,
        BigDecimal gastosOtros,

        // ── Referencias ───────────────────────────────────────────
        @NotBlank(message = "ref1Nombre no debe estar vacío")
        String ref1Nombre,

        @NotBlank(message = "ref1Telefono no debe estar vacío")
        String ref1Telefono,

        @NotBlank(message = "ref1Parentesco no debe estar vacío")
        String ref1Parentesco,

        @NotBlank(message = "ref2Nombre no debe estar vacío")
        String ref2Nombre,

        @NotBlank(message = "ref2Telefono no debe estar vacío")
        String ref2Telefono,

        @NotBlank(message = "ref2Parentesco no debe estar vacío")
        String ref2Parentesco,

        // ── Aval ──────────────────────────────────────────────────
        String avalNombre,
        String avalTelefono,
        String avalDireccion,
        String avalIdentificacion,

        // ── Asignación ────────────────────────────────────────────
        Long asesorId,

        @NotNull(message = "sucursalId no debe ser nulo")
        Long sucursalId
) {}
