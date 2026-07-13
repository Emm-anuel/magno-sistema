package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InversionReporteDTO(
        LocalDate fecha,
        String concepto,
        String descripcion,
        BigDecimal monto) {
}
