package com.magno.dto.credito;

import com.magno.model.TipoPago;
import com.magno.service.CreditoCalculoService.ResumenCalculo;

import java.math.BigDecimal;

/**
 * Respuesta del endpoint GET /api/creditos/calcular?capital=X
 * Usado para preview en tiempo real en el formulario de Nueva Solicitud.
 */
public record ProductoCalculoDTO(
        BigDecimal capital,
        int plazo,
        BigDecimal tasa,
        BigDecimal cargoFinanciero,
        BigDecimal totalAPagar,
        BigDecimal pagoPeriodico,
        BigDecimal pagoAdelantado,
        String descripcionProducto,
        TipoPago tipoPago
) {
    public static ProductoCalculoDTO from(ResumenCalculo c, String descripcion, TipoPago tipoPago) {
        return new ProductoCalculoDTO(
                c.capital(),
                c.plazo(),
                c.tasa(),
                c.cargoFinanciero(),
                c.totalAPagar(),
                c.pagoPeriodico(),
                c.pagoAdelantado(),
                descripcion,
                tipoPago
        );
    }
}
