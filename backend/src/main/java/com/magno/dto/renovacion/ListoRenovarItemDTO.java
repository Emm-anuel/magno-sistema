package com.magno.dto.renovacion;

import java.math.BigDecimal;

public record ListoRenovarItemDTO(
        Long clienteId,
        String clienteNombre,
        Long creditoId,
        BigDecimal montoCapital,
        Integer plazoDias,
        BigDecimal pagoPeriodico,
        Long asesorId,
        String asesorNombre,
        Long sucursalId,
        String sucursalNombre,
        long pagosRealizados,
        int pagosRestantes,
        BigDecimal multasPendientes
) {}
