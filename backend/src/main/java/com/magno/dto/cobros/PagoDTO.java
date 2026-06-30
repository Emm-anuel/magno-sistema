package com.magno.dto.cobros;

import com.magno.model.CalendarioPago;
import com.magno.model.Pago;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PagoDTO(
                Long id,
                Long creditoId,
                ClienteResumenCobrosDTO cliente,
                Integer numeroPago,
                LocalDate fechaPago,
                BigDecimal montoRecibido,
                BigDecimal montoEsperado,
                Boolean esCompleto,
                String razonNoPago,
                BigDecimal multaAplicada,
                String tipoPago,
                UsuarioResumenDTO registradoPor,
                UsuarioResumenDTO modificadoPor,
                OffsetDateTime fechaModificacion,
                OffsetDateTime createdAt,
                Boolean esPendiente) {

        public static PagoDTO from(Pago p) {
                return new PagoDTO(
                                p.getId(),
                                p.getCredito().getId(),
                                new ClienteResumenCobrosDTO(
                                                p.getCliente().getId(),
                                                p.getCliente().getNombreCompleto()),
                                p.getNumeroPago(),
                                p.getFechaPago(),
                                p.getMontoRecibido(),
                                p.getMontoEsperado(),
                                p.getEsCompleto(),
                                p.getRazonNoPago(),
                                p.getMultaAplicada(),
                                p.getCredito().getTipoPago().toString(),
                                p.getRegistradoPor() != null
                                                ? new UsuarioResumenDTO(p.getRegistradoPor().getId(),
                                                                p.getRegistradoPor().getNombreCompleto())
                                                : null,
                                p.getModificadoPor() != null
                                                ? new UsuarioResumenDTO(p.getModificadoPor().getId(),
                                                                p.getModificadoPor().getNombreCompleto())
                                                : null,
                                p.getFechaModificacion(),
                                p.getCreatedAt(),
                                false);
        }

        public static PagoDTO fromCalendario(CalendarioPago cp) {
                var c = cp.getCredito();
                return new PagoDTO(
                                null,
                                c.getId(),
                                new ClienteResumenCobrosDTO(
                                                c.getCliente().getId(),
                                                c.getCliente().getNombreCompleto()),
                                cp.getNumeroPago(),
                                cp.getFechaProgramada(),
                                null,
                                cp.getMontoEsperado(),
                                null,
                                null,
                                BigDecimal.ZERO,
                                c.getTipoPago().toString(),
                                new UsuarioResumenDTO(c.getAsesor().getId(),
                                                c.getAsesor().getNombreCompleto()),
                                null,
                                null,
                                null,
                                true);
        }

        public record ClienteResumenCobrosDTO(Long id, String nombreCompleto) {
        }

        public record UsuarioResumenDTO(Long id, String nombreCompleto) {
        }
}
