package com.magno.dto.cobros;

import java.math.BigDecimal;

/**
 * Representa a un cliente en la ruta del día de un asesor.
 * Un registro por cada cliente con crédito activo.
 */
public record ClienteRutaDTO(
        Long clienteId,
        String nombreCompleto,
        String celular,
        String negocioNombre,
        Long asesorId,
        String asesorNombre,

        Long creditoId,
        BigDecimal montoCapital,
        BigDecimal pagoPeriodico,

        Integer numeroPagoHoy,    // número del pago de hoy según calendario
        Integer totalPagos,       // 25 o 30

        /**
         * Estado del pago de hoy:
         * SIN_REGISTRO → no se ha registrado aún
         * PAGADO       → pagó completo
         * PARCIAL      → pagó incompleto (abono)
         * NO_PAGADO    → marcado como no pagó
         * INHABIL      → fecha es día festivo / fin de semana
         */
        String estadoHoy,

        BigDecimal montoRecibidoHoy,   // si ya registró, cuánto recibió
        BigDecimal multasPendientes,   // suma de multas no cobradas de este crédito
        String razonNoPago,            // para tooltip en UI
        Long pagoIdHoy                 // id del pago registrado hoy (para PATCH)
) {}
