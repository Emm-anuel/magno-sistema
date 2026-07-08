package com.magno.dto.caja;

import java.math.BigDecimal;
import java.util.List;

public record CajaCierrePreviewDTO(
        Long cajaId,
        BigDecimal montoApertura,

        // Inversiones — solo el subtotal; el detalle está en /inversiones
        BigDecimal subtotalInversiones,

        // Cobros por asesor
        List<CobroAsesorItemDTO> cobrosPorAsesor,
        BigDecimal totalIngresoCarteras,

        // Desembolsos desglosados
        BigDecimal desembolsosCreditosNuevos,
        BigDecimal desembolsosRenovaciones,
        BigDecimal totalDesembolsos,

        // Fórmula: apertura + ingresos − desembolsos + inversiones
        BigDecimal subtotalCaja,

        // Libres
        BigDecimal porcentajeAhorro,
        BigDecimal montoLibres,
        BigDecimal total,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal totalRealLibres,

        // Multas
        List<MultaAsesorItemDTO> multasPorAsesor,
        BigDecimal totalMultasCobradas,
        BigDecimal multasCobrasRenovaciones,
        BigDecimal totalMultasCondonadas
) {}
