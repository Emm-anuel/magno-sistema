package com.magno.dto.admin;

import com.magno.model.ConfigMulta;

import java.math.BigDecimal;

public record ConfigMultaAdminDTO(
        Long id,
        Long sucursalId,
        BigDecimal rangoMin,
        BigDecimal rangoMax,
        BigDecimal multaNoPago,
        BigDecimal multaIncompletos,
        BigDecimal multaSemanalNoPago,
        BigDecimal multaSemanalIncompletos
) {
    public static ConfigMultaAdminDTO from(ConfigMulta m) {
        return new ConfigMultaAdminDTO(
                m.getId(),
                m.getSucursalId(),
                m.getRangoMin(),
                m.getRangoMax(),
                m.getMultaNoPago(),
                m.getMultaIncompletos(),
                m.getMultaSemanalNoPago(),
                m.getMultaSemanalIncompletos());
    }
}
