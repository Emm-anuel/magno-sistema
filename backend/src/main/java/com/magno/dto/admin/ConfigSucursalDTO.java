package com.magno.dto.admin;

import com.magno.model.ConfigSucursal;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ConfigSucursalDTO(
        Long id,
        Long sucursalId,
        LocalTime horaLimiteOperacion,
        BigDecimal porcentajeAhorro,
        BigDecimal montoAhorroFijo,
        String diaPagoNomina
) {
    public static ConfigSucursalDTO from(ConfigSucursal c) {
        return new ConfigSucursalDTO(
                c.getId(),
                c.getSucursalId(),
                c.getHoraLimiteOperacion(),
                c.getPorcentajeAhorro(),
                c.getMontoAhorroFijo(),
                c.getDiaPagoNomina());
    }

    /** Valores por defecto cuando no existe fila en BD */
    public static ConfigSucursalDTO defaults(Long sucursalId) {
        return new ConfigSucursalDTO(
                null,
                sucursalId,
                LocalTime.of(17, 0),
                new BigDecimal("0.2400"),
                BigDecimal.ZERO,
                "JUEVES");
    }
}
