package com.magno.dto.cobros;

import com.magno.model.Multa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record MultaDTO(
        Long id,
        Long creditoId,
        Long clienteId,
        Long pagoId,
        String tipo,
        BigDecimal monto,
        LocalDate fecha,
        Boolean cobrada,
        Long cobradaEnPagoId,
        Boolean condonada,
        Long condonadaEnRenovacionId,
        String condonadaPorNombre,
        OffsetDateTime fechaCondonacion,
        String motivoCondonacion
) {
    public static MultaDTO from(Multa m) {
        return new MultaDTO(
                m.getId(),
                m.getCredito().getId(),
                m.getCliente().getId(),
                m.getPago() != null ? m.getPago().getId() : null,
                m.getTipo(),
                m.getMonto(),
                m.getFecha(),
                m.getCobrada(),
                m.getCobradaEnPago() != null ? m.getCobradaEnPago().getId() : null,
                m.getCondonada(),
                m.getCondonadaEnRenovacion() != null ? m.getCondonadaEnRenovacion().getId() : null,
                m.getCondonadaPor() != null ? m.getCondonadaPor().getNombreCompleto() : null,
                m.getFechaCondonacion(),
                m.getMotivoCondonacion()
        );
    }
}
