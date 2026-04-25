package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MovimientoInversionDTO(
        Long id,
        Long conceptoInversionId,
        String conceptoNombre,
        String descripcion,
        BigDecimal monto,
        Long registradoPorId,
        String registradoPorNombre,
        OffsetDateTime createdAt
) {}
