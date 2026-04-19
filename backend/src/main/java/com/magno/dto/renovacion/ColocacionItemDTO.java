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
        String tipo,     // NUEVO | RENOVACION
        String salidaDe, // CAJA | RUTA (null para créditos nuevos sin tracking)
        Long refId       // creditoId o renovacionId según tipo
) {}
