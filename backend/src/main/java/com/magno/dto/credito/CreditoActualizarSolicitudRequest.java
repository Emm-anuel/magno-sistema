package com.magno.dto.credito;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record CreditoActualizarSolicitudRequest(

        @NotNull(message = "El asesor es requerido") Long asesorId,

        @NotNull(message = "El monto solicitado es requerido") @DecimalMin(value = "1000.00", message = "El monto mínimo es $1,000") BigDecimal montoSolicitado,

        @NotNull(message = "El tipo de pago es requerido") String tipoPago,

        String garantiaDescripcion,

        List<String> evidenciaUrls,

        String lugar) {
}
