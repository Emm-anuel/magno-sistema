package com.magno.dto.renovacion;

import com.magno.model.Multa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record MultaCondonadaDTO(
        Long id,
        BigDecimal monto,
        String tipo,
        LocalDate fecha,
        String motivoCondonacion,
        String condonadaPorNombre,
        OffsetDateTime fechaCondonacion
) {
    public static MultaCondonadaDTO from(Multa m) {
        return new MultaCondonadaDTO(
                m.getId(),
                m.getMonto(),
                m.getTipo(),
                m.getFecha(),
                m.getMotivoCondonacion(),
                m.getCondonadaPor() != null ? m.getCondonadaPor().getNombreCompleto() : null,
                m.getFechaCondonacion()
        );
    }
}
