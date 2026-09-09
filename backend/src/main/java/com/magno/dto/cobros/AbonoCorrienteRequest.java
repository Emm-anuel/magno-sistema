package com.magno.dto.cobros;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AbonoCorrienteRequest(

        @NotNull(message = "credito_id es obligatorio")
        @JsonAlias("credito_id")
        Long creditoId,

        @NotNull(message = "monto_recibido es obligatorio")
        @DecimalMin(value = "0.01", message = "monto_recibido debe ser mayor a 0")
        @JsonAlias("monto_recibido")
        BigDecimal montoRecibido,

        @JsonAlias("fecha_pago")
        LocalDate fechaPago,

        @JsonAlias("incluir_multas")
        Boolean incluirMultas
) {
    public AbonoCorrienteRequest {
        if (incluirMultas == null) {
            incluirMultas = true;
        }
    }

    public AbonoCorrienteRequest(Long creditoId, BigDecimal montoRecibido, LocalDate fechaPago) {
        this(creditoId, montoRecibido, fechaPago, true);
    }
}
