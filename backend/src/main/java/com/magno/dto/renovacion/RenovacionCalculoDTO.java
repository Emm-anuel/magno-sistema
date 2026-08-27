package com.magno.dto.renovacion;

import java.math.BigDecimal;

/**
 * Resultado del cálculo previo de una renovación.
 * Se devuelve en GET /api/renovaciones/calcular para mostrar
 * los valores en tiempo real en el formulario del frontend.
 */
public record RenovacionCalculoDTO(
        Long creditoAnteriorId,
        BigDecimal montoAnterior,
        BigDecimal pagoPeriodicoAnterior,
        int plazoDiasAnterior,

        BigDecimal montoNuevo,
        int pagosRestantes,
        BigDecimal montoPagosRestantes,
        int pagosConAbonoParcial,
        BigDecimal saldoAbonosParciales,
        BigDecimal multasPendientes,
        BigDecimal pagoAdelantadoNuevo,
        BigDecimal montoDesembolso,

        // Datos del nuevo crédito calculados
        int plazoDiasNuevo,
        BigDecimal tasaNueva,
        BigDecimal cargoFinancieroNuevo,
        BigDecimal totalAPagarNuevo,
        BigDecimal pagoPeriodicoNuevo,

        // Restricción de monto
        boolean puedeAumentarMonto,
        String advertenciaMonto
) {}
