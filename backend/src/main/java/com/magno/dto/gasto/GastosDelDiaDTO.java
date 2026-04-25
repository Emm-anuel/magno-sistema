package com.magno.dto.gasto;

import java.math.BigDecimal;
import java.util.List;

public record GastosDelDiaDTO(
        Long cajaId,
        List<GastoAgrupadoDTO> grupos,
        BigDecimal total
) {}
