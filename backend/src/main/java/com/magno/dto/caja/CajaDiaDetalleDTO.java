package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record CajaDiaDetalleDTO(
        Long id,
        Long sucursalId,
        String sucursalNombre,
        LocalDate fecha,
        String estado,
        BigDecimal montoApertura,
        String conceptoApertura,
        Long abiertaPorId,
        String abiertaPorNombre,
        OffsetDateTime fechaHoraApertura,
        Long cerradaPorId,
        String cerradaPorNombre,
        OffsetDateTime fechaHoraCierre,
        BigDecimal ingresoCarteras,
        BigDecimal desembolsos,
        BigDecimal subtotalCaja,
        BigDecimal montoLibres,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalRealLibres,
        List<MovimientoInversionDTO> inversiones
) {}
