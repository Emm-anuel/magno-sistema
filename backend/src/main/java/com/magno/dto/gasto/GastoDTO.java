package com.magno.dto.gasto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record GastoDTO(
        Long id,
        Long cajaId,
        Long categoriaId,
        String categoriaNombre,
        String concepto,
        BigDecimal monto,
        Long registradoPorId,
        String registradoPorNombre,
        OffsetDateTime createdAt
) {}
