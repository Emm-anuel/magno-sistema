package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.time.LocalDate;

public record GastoReporteDTO(
        LocalDate fecha,
        String categoria,
        String concepto,
        BigDecimal monto) {
}
