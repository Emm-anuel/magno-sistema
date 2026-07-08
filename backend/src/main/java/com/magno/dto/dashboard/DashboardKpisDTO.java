package com.magno.dto.dashboard;

import java.math.BigDecimal;

public record DashboardKpisDTO(
        BigDecimal cobros,
        BigDecimal pagosRuta,
        BigDecimal abonosAdeudo,
        BigDecimal totalCobrado,
        long creditosActivos,
        BigDecimal multas,
        BigDecimal multasRuta,
        BigDecimal multasAbonos,
        BigDecimal porcentajeAhorro,
        BigDecimal montoAhorro,
        BigDecimal montoAhorroFijo,
        BigDecimal desembolsos,
        long creditosEnMora) {
}
