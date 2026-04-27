package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReportePorAsesorDTO(
                List<AsesorResumenDTO> asesores,
                long totalCobrosRegistrados,
                BigDecimal totalMontoCobrado,
                BigDecimal totalMultasCobradas,
                int totalClientesActivos,
                BigDecimal totalMontoColocado,
                int totalClientesEnMora) {
}
