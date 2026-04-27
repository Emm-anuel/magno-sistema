package com.magno.dto.reporte;

import java.math.BigDecimal;

public record CreditoActivoDTO(
                Long creditoId,
                String clienteNombre,
                String asesorNombre,
                BigDecimal montoCapital,
                int pagosRealizados,
                int pagosTotal,
                BigDecimal saldoPendiente,
                BigDecimal multasPendientes,
                boolean enMora) {
}
