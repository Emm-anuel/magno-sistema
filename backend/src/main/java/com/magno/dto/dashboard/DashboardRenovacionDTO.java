package com.magno.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DashboardRenovacionDTO(
        Long renovacionId,
        String clienteNombre,
        BigDecimal creditoNuevo,
        BigDecimal montoDesembolso,
        LocalDate fecha) {
}
