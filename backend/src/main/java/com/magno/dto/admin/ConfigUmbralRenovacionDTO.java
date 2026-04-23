package com.magno.dto.admin;

import com.magno.model.ConfigUmbralRenovacion;

public record ConfigUmbralRenovacionDTO(
        Long id,
        Long sucursalId,
        String tipoPago,
        Integer plazo,
        Integer umbralPagos
) {
    public static ConfigUmbralRenovacionDTO from(ConfigUmbralRenovacion u) {
        return new ConfigUmbralRenovacionDTO(
                u.getId(),
                u.getSucursalId(),
                u.getTipoPago(),
                u.getPlazo(),
                u.getUmbralPagos());
    }
}
