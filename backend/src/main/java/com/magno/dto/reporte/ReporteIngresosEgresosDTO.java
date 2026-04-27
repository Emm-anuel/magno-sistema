package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReporteIngresosEgresosDTO(
        List<FilaDiariaDTO> filas,
        BigDecimal totalIngresoCarteras,
        BigDecimal totalDesembolsos,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal subtotalNeto) {
}
