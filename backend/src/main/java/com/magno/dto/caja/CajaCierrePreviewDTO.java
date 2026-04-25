package com.magno.dto.caja;

import java.math.BigDecimal;
import java.util.List;

public record CajaCierrePreviewDTO(
        Long cajaId,
        BigDecimal montoApertura,

        // Inversiones
        List<MovimientoInversionDTO> inversiones,
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
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalRealLibres,

        // Multas
        List<MultaAsesorItemDTO> multasPorAsesor,
        BigDecimal totalMultasCobradas
) {}
