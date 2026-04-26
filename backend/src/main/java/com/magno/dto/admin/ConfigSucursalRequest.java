package com.magno.dto.admin;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ConfigSucursalRequest(
                @NotNull LocalTime horaLimiteOperacion,
                @NotNull @DecimalMin("0.00") @DecimalMax("1.00") BigDecimal porcentajeAhorro,
                @NotNull @DecimalMin("0.00") BigDecimal montoAhorroFijo,
                @NotBlank @Pattern(regexp = "^(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES)$", message = "dia_pago_nomina debe ser un día hábil: LUNES, MARTES, MIERCOLES, JUEVES o VIERNES") String diaPagoNomina) {
}
