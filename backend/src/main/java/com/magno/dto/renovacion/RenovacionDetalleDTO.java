package com.magno.dto.renovacion;

import com.magno.model.Renovacion;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

public record RenovacionDetalleDTO(
        Long id,
        ClienteInfo cliente,
        AsesorInfo asesor,
        CreditoInfo creditoAnterior,
        CreditoInfo creditoNuevo,
        LocalDate fecha,
        int pagosRestantes,
        BigDecimal montoPagosRestantes,
        BigDecimal multasPendientes,
        BigDecimal pagoAdelantado,
        BigDecimal montoDesembolso,
        String salidaDe,
        String garantiaDescripcion,
        String videoEntregaUrl,
        List<String> evidenciaUrls,
        OffsetDateTime createdAt
) {
    public record ClienteInfo(Long id, String nombreCompleto, String celular) {}
    public record AsesorInfo(Long id, String nombreCompleto) {}
    public record CreditoInfo(Long id, BigDecimal montoCapital, Integer plazoDias, BigDecimal pagoPeriodico, String estado) {}

    public static RenovacionDetalleDTO from(Renovacion r) {
        return new RenovacionDetalleDTO(
                r.getId(),
                new ClienteInfo(
                        r.getCliente().getId(),
                        r.getCliente().getNombreCompleto(),
                        r.getCliente().getCelular()),
                new AsesorInfo(r.getAsesor().getId(), r.getAsesor().getNombreCompleto()),
                new CreditoInfo(
                        r.getCreditoAnterior().getId(),
                        r.getCreditoAnterior().getMontoCapital(),
                        r.getCreditoAnterior().getPlazoDias(),
                        r.getCreditoAnterior().getPagoPeriodico(),
                        r.getCreditoAnterior().getEstado().name()),
                new CreditoInfo(
                        r.getCreditoNuevo().getId(),
                        r.getCreditoNuevo().getMontoCapital(),
                        r.getCreditoNuevo().getPlazoDias(),
                        r.getCreditoNuevo().getPagoPeriodico(),
                        r.getCreditoNuevo().getEstado().name()),
                r.getFecha(),
                r.getPagosRestantes(),
                r.getMontoPagosRestantes(),
                r.getMultasPendientes(),
                r.getPagoAdelantado(),
                r.getMontoDesembolso(),
                r.getSalidaDe(),
                r.getGarantiaDescripcion(),
                r.getVideoEntregaUrl(),
                r.getEvidenciaUrls() != null ? Arrays.asList(r.getEvidenciaUrls()) : List.of(),
                r.getCreatedAt()
        );
    }
}
