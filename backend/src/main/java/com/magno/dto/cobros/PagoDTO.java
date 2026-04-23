package com.magno.dto.cobros;

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
                OffsetDateTime createdAt) {

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
                                p.getCreatedAt());
        }

        public record ClienteResumenCobrosDTO(Long id, String nombreCompleto) {
        }

        public record UsuarioResumenDTO(Long id, String nombreCompleto) {
        }
}
