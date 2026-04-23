package com.magno.dto.renovacion;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Una fila en la tabla de Colocaciones Semanales.
 * Puede representar un crédito nuevo o una renovación.
 */
public record ColocacionItemDTO(
        LocalDate fecha,
        String clienteNombre,
        Long clienteId,
        BigDecimal creditoAnterior, // null para créditos nuevos
        BigDecimal creditoNuevo,
        BigDecimal desembolso,
        String asesorNombre,
        String tipoPago, // DIARIO | SEMANAL
        String tipo, // NUEVO | RENOVACION
        Long refId // creditoId o renovacionId según tipo
) {
}
