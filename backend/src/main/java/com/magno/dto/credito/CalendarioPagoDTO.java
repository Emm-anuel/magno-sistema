package com.magno.dto.credito;

import com.magno.model.CalendarioPago;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CalendarioPagoDTO(
        Long id,
        Integer numeroPago,
        LocalDate fechaProgramada,
        BigDecimal montoEsperado,
        BigDecimal montoAbonado,
        String estado
) {
    public static CalendarioPagoDTO from(CalendarioPago cp) {
        return from(cp, BigDecimal.ZERO);
    }

    public static CalendarioPagoDTO from(CalendarioPago cp, BigDecimal montoAbonado) {
        return new CalendarioPagoDTO(
                cp.getId(),
                cp.getNumeroPago(),
                cp.getFechaProgramada(),
                cp.getMontoEsperado(),
                montoAbonado != null ? montoAbonado : BigDecimal.ZERO,
                cp.getEstado().name()
        );
    }
}
