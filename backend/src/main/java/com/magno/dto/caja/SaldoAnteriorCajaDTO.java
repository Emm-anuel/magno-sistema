package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SaldoAnteriorCajaDTO(
        boolean disponible,
        BigDecimal monto,
        LocalDate fecha
) {}
