package com.magno.dto.renovacion;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ColocacionesSemanaDTO(
        LocalDate semanaInicio,
        LocalDate semanaFin,
        List<ColocacionItemDTO> items,
        BigDecimal totalDesembolsos,
        BigDecimal totalCaja  // solo filas con salida_de = 'CAJA'
) {}
