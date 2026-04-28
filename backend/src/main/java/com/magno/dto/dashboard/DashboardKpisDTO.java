package com.magno.dto.dashboard;

import java.math.BigDecimal;

public record DashboardKpisDTO(
        BigDecimal cobros,
        long creditosActivos,
        BigDecimal multas,
        BigDecimal porcentajeAhorro,
        BigDecimal montoAhorro,
        BigDecimal montoAhorroFijo,
        BigDecimal desembolsos,
        long creditosEnMora) {
}
