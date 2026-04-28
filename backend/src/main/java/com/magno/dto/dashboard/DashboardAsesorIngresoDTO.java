package com.magno.dto.dashboard;

import java.math.BigDecimal;

public record DashboardAsesorIngresoDTO(
        Long asesorId,
        String asesorNombre,
        BigDecimal ingresoCarteras,
        BigDecimal desembolsos,
        BigDecimal multas,
        long clientesActivos) {
}
