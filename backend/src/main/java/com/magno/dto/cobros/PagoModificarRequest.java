package com.magno.dto.cobros;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Request para modificar un pago ya registrado.
 * Solo ADMINISTRADOR y SUPERVISOR pueden invocar este endpoint.
 */
public record PagoModificarRequest(

        BigDecimal montoRecibido,

        @Pattern(regexp = "CAJA|RUTA", message = "modalidad debe ser CAJA o RUTA")
        String modalidad,

        String razonNoPago,

        @NotBlank(message = "motivo_modificacion es obligatorio para la bitácora")
        String motivoModificacion
) {}
