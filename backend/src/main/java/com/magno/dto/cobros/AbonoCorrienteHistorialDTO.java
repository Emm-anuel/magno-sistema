package com.magno.dto.cobros;

import com.magno.model.AbonoCoberturaDetalle;
import com.magno.model.AbonoCorriente;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record AbonoCorrienteHistorialDTO(
        Long abonoId,
        Long creditoId,
        PagoDTO.ClienteResumenCobrosDTO cliente,
        LocalDate fecha,
        BigDecimal montoTotal,
        BigDecimal montoDistribuido,
        BigDecimal montoSobrante,
        BigDecimal montoMulta,
        int diasCubiertos,
        int diasParciales,
        PagoDTO.UsuarioResumenDTO registradoPor,
        OffsetDateTime createdAt) {

    public static AbonoCorrienteHistorialDTO from(
            AbonoCorriente abono,
            List<AbonoCoberturaDetalle> coberturas) {
        int cubiertos = (int) coberturas.stream()
                .filter(c -> !Boolean.TRUE.equals(c.getEsParcial()))
                .count();
        int parciales = (int) coberturas.stream()
                .filter(c -> Boolean.TRUE.equals(c.getEsParcial()))
                .count();
        BigDecimal multa = coberturas.stream()
                .map(AbonoCoberturaDetalle::getMontoMulta)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new AbonoCorrienteHistorialDTO(
                abono.getId(),
                abono.getCredito().getId(),
                new PagoDTO.ClienteResumenCobrosDTO(
                        abono.getCredito().getCliente().getId(),
                        abono.getCredito().getCliente().getNombreCompleto()),
                abono.getFecha(),
                abono.getMontoTotal(),
                abono.getMontoDistribuido(),
                abono.getMontoSobrante(),
                multa,
                cubiertos,
                parciales,
                abono.getRegistradoPor() != null
                        ? new PagoDTO.UsuarioResumenDTO(
                                abono.getRegistradoPor().getId(),
                                abono.getRegistradoPor().getNombreCompleto())
                        : null,
                abono.getCreatedAt());
    }
}
