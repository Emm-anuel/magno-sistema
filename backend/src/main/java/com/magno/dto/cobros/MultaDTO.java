package com.magno.dto.cobros;

import com.magno.model.Multa;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MultaDTO(
        Long id,
        Long creditoId,
        Long clienteId,
        Long pagoId,
        String tipo,
        BigDecimal monto,
        LocalDate fecha,
        Boolean cobrada,
        Long cobradaEnPagoId
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
                m.getCobradaEnPago() != null ? m.getCobradaEnPago().getId() : null
        );
    }
}
