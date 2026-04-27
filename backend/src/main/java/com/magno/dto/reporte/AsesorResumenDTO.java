package com.magno.dto.reporte;

import java.math.BigDecimal;

public record AsesorResumenDTO(
                Long asesorId,
                String asesorNombre,
                long cobrosRegistrados,
                BigDecimal montoCobrado,
                BigDecimal multasCobradas,
                long pagosIncompletos,
                int clientesActivos,
                BigDecimal montoTotalColocado,
                int clientesEnMora,
                BigDecimal montoEnRiesgo) {
}
