package com.magno.dto.gasto;

import java.math.BigDecimal;
import java.util.List;

public record GastoAgrupadoDTO(
        Long categoriaId,
        String categoriaNombre,
        List<GastoDTO> gastos,
        BigDecimal subtotal
) {}
