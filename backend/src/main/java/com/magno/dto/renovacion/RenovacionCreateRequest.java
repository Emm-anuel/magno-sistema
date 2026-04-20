package com.magno.dto.renovacion;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record RenovacionCreateRequest(

                @NotNull(message = "creditoAnteriorId es requerido") Long creditoAnteriorId,

                @NotNull(message = "montoNuevo es requerido") @DecimalMin(value = "1000", message = "El monto mínimo es $1,000") BigDecimal montoNuevo,

                @NotBlank(message = "tipoPago es requerido") String tipoPago, // DIARIO | SEMANAL

                String garantiaDescripcion,
                List<String> evidenciaUrls,
                String videoEntregaUrl) {
}
