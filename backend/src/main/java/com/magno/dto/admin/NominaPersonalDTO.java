package com.magno.dto.admin;

import com.magno.model.NominaPersonal;

import java.math.BigDecimal;

public record NominaPersonalDTO(
        Long id,
        Long sucursalId,
        String nombre,
        String puesto,
        BigDecimal montoSemanal
) {
    public static NominaPersonalDTO from(NominaPersonal n) {
        return new NominaPersonalDTO(
                n.getId(),
                n.getSucursalId(),
                n.getNombre(),
                n.getPuesto(),
                n.getMontoSemanal());
    }
}
