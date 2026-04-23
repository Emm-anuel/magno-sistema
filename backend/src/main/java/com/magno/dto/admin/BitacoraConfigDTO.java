package com.magno.dto.admin;

import com.magno.model.BitacoraConfig;

import java.time.OffsetDateTime;

public record BitacoraConfigDTO(
        Long id,
        Long usuarioId,
        String usuarioNombre,
        Long sucursalId,
        String sucursalNombre,
        String seccion,
        String campo,
        String valorAnterior,
        String valorNuevo,
        OffsetDateTime createdAt
) {
    /** Construcción sin nombres resueltos (para uso interno rápido) */
    public static BitacoraConfigDTO from(BitacoraConfig b) {
        return new BitacoraConfigDTO(
                b.getId(),
                b.getUsuarioId(),
                null,
                b.getSucursalId(),
                null,
                b.getSeccion(),
                b.getCampo(),
                b.getValorAnterior(),
                b.getValorNuevo(),
                b.getCreatedAt());
    }
}
