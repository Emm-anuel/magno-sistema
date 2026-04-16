package com.magno.dto.cobros;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Request para registrar un cobro (pago o no pago) de un cliente.
 */
public record PagoRegistrarRequest(

        @NotNull(message = "credito_id es obligatorio")
        Long creditoId,

        @NotNull(message = "modalidad es obligatoria")
        @Pattern(regexp = "CAJA|RUTA", message = "modalidad debe ser CAJA o RUTA")
        String modalidad,

        @NotNull(message = "no_pago es obligatorio")
        Boolean noPago,

        /** Requerido si noPago = false. Acepta abonos parciales. */
        @DecimalMin(value = "0.01", message = "monto_recibido debe ser mayor a 0")
        BigDecimal montoRecibido,

        /** Obligatorio si noPago = true. */
        String razonNoPago
) {}
