package com.magno.dto.cobros;

import com.magno.model.AbonoCoberturaDetalle;
import com.magno.model.AbonoCorriente;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record AbonoCorrienteDTO(
        Long abonoId,
        Long creditoId,
        LocalDate fecha,
        OffsetDateTime createdAt,
        BigDecimal montoTotal,
        BigDecimal montoDistribuido,
        BigDecimal montoSobrante,
        int diasCubiertos,
        int diasParciales,
        List<CoberturaDetalleDTO> coberturas
) {

    public record CoberturaDetalleDTO(
            Integer numeroPago,
            LocalDate fechaProgramada,
            BigDecimal montoCuota,
            BigDecimal montoMulta,
            BigDecimal totalAplicado,
            boolean esParcial
    ) {
        public static CoberturaDetalleDTO from(AbonoCoberturaDetalle d) {
            return new CoberturaDetalleDTO(
                    d.getNumeroPago(),
                    d.getCalendarioPago().getFechaProgramada(),
                    d.getMontoCuota(),
                    d.getMontoMulta(),
                    d.getTotalAplicado(),
                    Boolean.TRUE.equals(d.getEsParcial())
            );
        }
    }

    public static AbonoCorrienteDTO from(AbonoCorriente a, List<AbonoCoberturaDetalle> coberturas) {
        List<CoberturaDetalleDTO> dtos = coberturas.stream()
                .map(CoberturaDetalleDTO::from)
                .toList();
        int cubiertos = (int) dtos.stream().filter(c -> !c.esParcial()).count();
        int parciales = (int) dtos.stream().filter(CoberturaDetalleDTO::esParcial).count();
        return new AbonoCorrienteDTO(
                a.getId(),
                a.getCredito().getId(),
                a.getFecha(),
                a.getCreatedAt(),
                a.getMontoTotal(),
                a.getMontoDistribuido(),
                a.getMontoSobrante(),
                cubiertos,
                parciales,
                dtos
        );
    }
}
