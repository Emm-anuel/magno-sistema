package com.magno.dto.credito;

import com.magno.model.CalendarioPago;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CalendarioPagoDTO(
        Long id,
        Integer numeroPago,
        LocalDate fechaProgramada,
        BigDecimal montoEsperado,
        String estado
) {
    public static CalendarioPagoDTO from(CalendarioPago cp) {
        return new CalendarioPagoDTO(
                cp.getId(),
                cp.getNumeroPago(),
                cp.getFechaProgramada(),
                cp.getMontoEsperado(),
                cp.getEstado().name()
        );
    }
}
