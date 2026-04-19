package com.magno.dto.cobros;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request para registrar un cobro (pago o no pago) de un cliente.
 */
public record PagoRegistrarRequest(

        @NotNull(message = "credito_id es obligatorio") @JsonAlias("credito_id") Long creditoId,

        @NotNull(message = "modalidad es obligatoria") @Pattern(regexp = "CAJA|RUTA", message = "modalidad debe ser CAJA o RUTA") String modalidad,

        @NotNull(message = "no_pago es obligatorio") @JsonAlias("no_pago") Boolean noPago,

        /** Requerido si noPago = false. Acepta abonos parciales. */
        @DecimalMin(value = "0.01", message = "monto_recibido debe ser mayor a 0") @JsonAlias("monto_recibido") BigDecimal montoRecibido,

        /** Obligatorio si noPago = true. */
        @JsonAlias("razon_no_pago") String razonNoPago,

        /**
         * Opcional: fecha a registrar (solo ADMINISTRADOR/SUPERVISOR para días
         * históricos).
         */
        @JsonAlias("fecha_pago") LocalDate fechaPago) {
}
