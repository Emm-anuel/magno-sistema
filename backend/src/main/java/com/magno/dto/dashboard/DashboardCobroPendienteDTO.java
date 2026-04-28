package com.magno.dto.dashboard;

import java.math.BigDecimal;

public record DashboardCobroPendienteDTO(
        Long creditoId,
        String clienteNombre,
        String asesorNombre,
        BigDecimal montoEsperado,
        String estado) {
}
