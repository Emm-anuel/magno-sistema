package com.magno.dto.caja;

import com.magno.model.NominaPago;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record NominaPagoDTO(
        Long id,
        BigDecimal totalPagado,
        Long registradoPorId,
        String registradoPorNombre,
        OffsetDateTime createdAt
) {
    public static NominaPagoDTO from(NominaPago n) {
        return new NominaPagoDTO(
                n.getId(),
                n.getTotalPagado(),
                n.getRegistradoPor().getId(),
                n.getRegistradoPor().getNombreCompleto(),
                n.getCreatedAt());
    }
}
