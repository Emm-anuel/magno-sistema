package com.magno.dto.credito;

import com.magno.model.Credito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * DTO liviano para listados de créditos.
 */
public record CreditoResumenDTO(
                Long id,
                ClienteInfo cliente,
                UsuarioInfo asesor,
                SucursalInfo sucursal,
                BigDecimal montoSolicitado,
                BigDecimal montoCapital,
                BigDecimal montoAprobado,
                BigDecimal pagoPeriodico,
                Integer plazoDias,
                String tipoPago,
                String estado,
                LocalDate fechaInicio,
                LocalDate fechaVencimiento,
                long pagosRealizados,
                int totalPagos,
                boolean tieneVideoEntrega,
                OffsetDateTime createdAt) {
        public record ClienteInfo(Long id, String nombreCompleto, String celular) {
        }

        public record UsuarioInfo(Long id, String nombreCompleto) {
        }

        public record SucursalInfo(Long id, String nombre) {
        }

        public static CreditoResumenDTO from(Credito c, long pagosRealizados) {
                ClienteInfo cliente = new ClienteInfo(
                                c.getCliente().getId(),
                                c.getCliente().getNombreCompleto(),
                                c.getCliente().getCelular());
                UsuarioInfo asesor = new UsuarioInfo(
                                c.getAsesor().getId(),
                                c.getAsesor().getNombreCompleto());
                SucursalInfo sucursal = new SucursalInfo(
                                c.getSucursal().getId(),
                                c.getSucursal().getNombre());
                return new CreditoResumenDTO(
                                c.getId(),
                                cliente,
                                asesor,
                                sucursal,
                                c.getMontoSolicitado(),
                                c.getMontoCapital(),
                                c.getMontoAprobado(),
                                c.getPagoPeriodico(),
                                c.getPlazoDias(),
                                c.getTipoPago().name(),
                                c.getEstado().name(),
                                c.getFechaInicio(),
                                c.getFechaVencimiento(),
                                pagosRealizados,
                                c.getPlazoDias(),
                                c.getVideoEntregaUrl() != null && !c.getVideoEntregaUrl().isBlank(),
                                c.getCreatedAt());
        }
}
