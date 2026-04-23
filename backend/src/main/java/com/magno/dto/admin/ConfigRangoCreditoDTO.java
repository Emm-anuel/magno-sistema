package com.magno.dto.admin;

import com.magno.model.ConfigRangoCredito;

import java.math.BigDecimal;

public record ConfigRangoCreditoDTO(
        Long id,
        Long sucursalId,
        String tipoPago,
        BigDecimal rangoMin,
        BigDecimal rangoMax,
        Integer plazo,
        BigDecimal tasaInteres
) {
    public static ConfigRangoCreditoDTO from(ConfigRangoCredito r) {
        return new ConfigRangoCreditoDTO(
                r.getId(),
                r.getSucursalId(),
                r.getTipoPago(),
                r.getRangoMin(),
                r.getRangoMax(),
                r.getPlazo(),
                r.getTasaInteres());
    }
}
