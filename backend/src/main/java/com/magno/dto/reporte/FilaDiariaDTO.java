package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FilaDiariaDTO(
        LocalDate fecha,
        BigDecimal montoApertura,
        BigDecimal ingresoCarteras,
        BigDecimal desembolsos,
        BigDecimal gastos,
        BigDecimal nomina,
        BigDecimal inversiones,
        BigDecimal subtotalCaja) {
}
