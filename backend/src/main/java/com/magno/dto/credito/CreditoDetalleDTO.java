package com.magno.dto.credito;

import com.magno.model.Credito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * DTO completo para la ficha de detalle de un crédito.
 * Incluye el calendario de pagos y estadísticas calculadas.
 */
public record CreditoDetalleDTO(
        Long id,

        // ── Relaciones ────────────────────────────────────────────
        CreditoResumenDTO.ClienteInfo cliente,
        CreditoResumenDTO.UsuarioInfo asesor,
        CreditoResumenDTO.SucursalInfo sucursal,

        // ── Producto ─────────────────────────────────────────────
        BigDecimal montoCapital,
        BigDecimal tasaInteres,
        BigDecimal cargoFinanciero,
        BigDecimal totalAPagar,
        BigDecimal pagoPeriodico,
        Integer plazoDias,
        String tipoPago,

        // ── Fechas ────────────────────────────────────────────────
        LocalDate fechaInicio,
        LocalDate fechaVencimiento,

        // ── Pago adelantado ───────────────────────────────────────
        BigDecimal pagoAdelantado,

        // ── Garantía y evidencia ──────────────────────────────────
        String garantiaDescripcion,
        String[] evidenciaUrls,
        String lugar,

        // ── Estado ───────────────────────────────────────────────
        String estado,

        // ── Aprobación (V4) ───────────────────────────────────────
        BigDecimal montoAprobado,
        String observaciones,
        OffsetDateTime fechaAprobacion,
        CreditoResumenDTO.UsuarioInfo aprobadoPor,

        // ── Desembolso (V4) ───────────────────────────────────────
        OffsetDateTime fechaDesembolso,
        String videoEntregaUrl,

        // ── Auditoría ────────────────────────────────────────────
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,

        // ── Calendario ────────────────────────────────────────────
        List<CalendarioPagoDTO> calendario,

        // ── Estadísticas ─────────────────────────────────────────
        Estadisticas estadisticas
) {
    public record Estadisticas(
            long pagosRealizados,
            long pagosPendientes,
            long pagosVencidos,
            BigDecimal multasPendientes,
            boolean elegibleRenovacion
    ) {}

    public static CreditoDetalleDTO from(Credito c,
                                          List<CalendarioPagoDTO> calendario,
                                          Estadisticas estadisticas) {
        CreditoResumenDTO.ClienteInfo cliente = new CreditoResumenDTO.ClienteInfo(
                c.getCliente().getId(),
                c.getCliente().getNombreCompleto(),
                c.getCliente().getCelular()
        );
        CreditoResumenDTO.UsuarioInfo asesor = new CreditoResumenDTO.UsuarioInfo(
                c.getAsesor().getId(),
                c.getAsesor().getNombreCompleto()
        );
        CreditoResumenDTO.SucursalInfo sucursal = new CreditoResumenDTO.SucursalInfo(
                c.getSucursal().getId(),
                c.getSucursal().getNombre()
        );
        CreditoResumenDTO.UsuarioInfo aprobadoPor = c.getAprobadoPor() != null
                ? new CreditoResumenDTO.UsuarioInfo(
                        c.getAprobadoPor().getId(),
                        c.getAprobadoPor().getNombreCompleto())
                : null;

        return new CreditoDetalleDTO(
                c.getId(),
                cliente,
                asesor,
                sucursal,
                c.getMontoCapital(),
                c.getTasaInteres(),
                c.getCargoFinanciero(),
                c.getTotalAPagar(),
                c.getPagoPeriodico(),
                c.getPlazoDias(),
                c.getTipoPago().name(),
                c.getFechaInicio(),
                c.getFechaVencimiento(),
                c.getPagoAdelantado(),
                c.getGarantiaDescripcion(),
                c.getEvidenciaUrls(),
                c.getLugar(),
                c.getEstado().name(),
                c.getMontoAprobado(),
                c.getObservaciones(),
                c.getFechaAprobacion(),
                aprobadoPor,
                c.getFechaDesembolso(),
                c.getVideoEntregaUrl(),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                calendario,
                estadisticas
        );
    }
}
