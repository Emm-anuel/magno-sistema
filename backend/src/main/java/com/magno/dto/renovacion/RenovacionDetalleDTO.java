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
                String estado,
                AsesorInfo aprobadoPor,
                OffsetDateTime fechaAprobacion,
                String motivoRechazo,
                BigDecimal montoNuevo,
                BigDecimal montoAprobado,
                AsesorInfo confirmadoPor,
                OffsetDateTime fechaConfirmacion,
                String tipoPago,
                int pagosRestantes,
                BigDecimal montoPagosRestantes,
                int pagosConAbonoParcial,
                BigDecimal multasPendientes,
                BigDecimal multasCondonadas,
                String motivoCondonacion,
                List<MultaCondonadaDTO> multasCondonadasDetalle,
                BigDecimal pagoAdelantado,
                BigDecimal montoDesembolso,
                String garantiaDescripcion,
                String videoEntregaUrl,
                List<String> evidenciaUrls,
                OffsetDateTime createdAt) {

        public record ClienteInfo(Long id, String nombreCompleto, String celular) {}
        public record AsesorInfo(Long id, String nombreCompleto, String sucursalNombre) {}
        public record CreditoInfo(Long id, BigDecimal montoCapital, Integer plazoDias,
                        BigDecimal pagoPeriodico, String estado) {}

        public static RenovacionDetalleDTO from(Renovacion r) {
                return from(r, List.of(), 0);
        }

        public static RenovacionDetalleDTO from(Renovacion r, List<MultaCondonadaDTO> condonadasDetalle) {
                return from(r, condonadasDetalle, 0);
        }

        public static RenovacionDetalleDTO from(Renovacion r, List<MultaCondonadaDTO> condonadasDetalle,
                        int pagosConAbonoParcial) {
                CreditoInfo creditoNuevoInfo = null;
                if (r.getCreditoNuevo() != null) {
                        creditoNuevoInfo = new CreditoInfo(
                                        r.getCreditoNuevo().getId(),
                                        r.getCreditoNuevo().getMontoCapital(),
                                        r.getCreditoNuevo().getPlazoDias(),
                                        r.getCreditoNuevo().getPagoPeriodico(),
                                        r.getCreditoNuevo().getEstado().name());
                }

                AsesorInfo aprobadoPorInfo = null;
                if (r.getAprobadoPor() != null) {
                        aprobadoPorInfo = new AsesorInfo(
                                        r.getAprobadoPor().getId(),
                                        r.getAprobadoPor().getNombreCompleto(),
                                        r.getAprobadoPor().getSucursal().getNombre());
                }

                AsesorInfo confirmadoPorInfo = null;
                if (r.getConfirmadoPor() != null) {
                        confirmadoPorInfo = new AsesorInfo(
                                        r.getConfirmadoPor().getId(),
                                        r.getConfirmadoPor().getNombreCompleto(),
                                        r.getConfirmadoPor().getSucursal().getNombre());
                }

                String motivoCond = condonadasDetalle.isEmpty() ? null : condonadasDetalle.get(0).motivoCondonacion();

                return new RenovacionDetalleDTO(
                                r.getId(),
                                new ClienteInfo(
                                                r.getCliente().getId(),
                                                r.getCliente().getNombreCompleto(),
                                                r.getCliente().getCelular()),
                                new AsesorInfo(r.getAsesor().getId(), r.getAsesor().getNombreCompleto(),
                                                r.getAsesor().getSucursal().getNombre()),
                                new CreditoInfo(
                                                r.getCreditoAnterior().getId(),
                                                r.getCreditoAnterior().getMontoCapital(),
                                                r.getCreditoAnterior().getPlazoDias(),
                                                r.getCreditoAnterior().getPagoPeriodico(),
                                                r.getCreditoAnterior().getEstado().name()),
                                creditoNuevoInfo,
                                r.getFecha(),
                                r.getEstado().name(),
                                aprobadoPorInfo,
                                r.getFechaAprobacion(),
                                r.getMotivoRechazo(),
                                r.getMontoNuevo(),
                                r.getMontoAprobado(),
                                confirmadoPorInfo,
                                r.getFechaConfirmacion(),
                                r.getTipoPago().name(),
                                r.getPagosRestantes(),
                                r.getMontoPagosRestantes(),
                                pagosConAbonoParcial,
                                r.getMultasPendientes(),
                                r.getMultasCondonadas(),
                                motivoCond,
                                condonadasDetalle,
                                r.getPagoAdelantado(),
                                r.getMontoDesembolso(),
                                r.getGarantiaDescripcion(),
                                r.getVideoEntregaUrl(),
                                r.getEvidenciaUrls() != null ? Arrays.asList(r.getEvidenciaUrls()) : List.of(),
                                r.getCreatedAt());
        }
}
