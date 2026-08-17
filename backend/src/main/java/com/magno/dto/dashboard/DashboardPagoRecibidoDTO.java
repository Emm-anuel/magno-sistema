package com.magno.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DashboardPagoRecibidoDTO(
        Long movimientoId,
        String tipoMovimiento,
        Long clienteId,
        String clienteNombre,
        Long asesorId,
        String asesorNombre,
        BigDecimal monto,
        LocalDate fecha,
        OffsetDateTime registradoEn) {
}
