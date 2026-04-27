package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReporteCarteraDTO(
                int totalCreditosActivos,
                BigDecimal montoTotalColocado,
                int creditosEnMora,
                BigDecimal montoEnRiesgo,
                List<CreditoActivoDTO> creditos) {
}
