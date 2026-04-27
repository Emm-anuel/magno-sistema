package com.magno.dto.reporte;

import com.magno.dto.renovacion.ColocacionItemDTO;

import java.math.BigDecimal;
import java.util.List;

public record ReporteColocacionesDTO(
                List<ColocacionItemDTO> items,
                BigDecimal totalDesembolsos,
                BigDecimal totalCaja) {
}
