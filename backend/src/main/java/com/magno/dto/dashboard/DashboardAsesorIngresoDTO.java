package com.magno.dto.dashboard;

import java.math.BigDecimal;

public record DashboardAsesorIngresoDTO(
        Long asesorId,
        String asesorNombre,
        BigDecimal ingresoCarteras,
        BigDecimal pagosRuta,
        BigDecimal abonosAdeudo,
        BigDecimal totalCobrado,
        BigDecimal desembolsos,
        BigDecimal multas,
        BigDecimal multasRuta,
        BigDecimal multasAbonos,
        long clientesActivos) {
}
