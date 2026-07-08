package com.magno.dto.cobros;

import java.math.BigDecimal;

/**
 * Cliente cuyo pago del día quedó sin registrar y que el sistema
 * marca (o marcará) automáticamente como "no pago" al cerrar la caja.
 */
public record ClienteNoPagoAutomaticoDTO(
        Long clienteId,
        String nombreCompleto,
        Long creditoId,
        Integer numeroPago,
        BigDecimal montoMulta
) {
}
