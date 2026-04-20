package com.magno.dto.credito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RenovacionVinculoDTO(
        Long renovacionId,
        OffsetDateTime fechaRenovacion,
        Integer pagosRestantes,
        BigDecimal montoPagosRestantes,
        BigDecimal montoDesembolso,
        Long creditoVinculadoId,
        BigDecimal montoCapitalVinculado
) {}
