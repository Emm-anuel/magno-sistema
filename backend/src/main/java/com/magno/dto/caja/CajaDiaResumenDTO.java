package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CajaDiaResumenDTO(
        Long id,
        LocalDate fecha,
        String sucursalNombre,
        String abiertaPorNombre,
        String cerradaPorNombre,
        OffsetDateTime fechaHoraCierre,
        BigDecimal subtotalCaja,
        BigDecimal montoLibres,
        BigDecimal total,
        String estado
) {}
