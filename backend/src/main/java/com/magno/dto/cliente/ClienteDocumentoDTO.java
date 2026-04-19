package com.magno.dto.cliente;

import com.magno.model.ClienteDocumento;

import java.time.OffsetDateTime;

public record ClienteDocumentoDTO(
        Long id,
        String tipo,
        String url,
        String nombre,
        OffsetDateTime createdAt
) {
    public static ClienteDocumentoDTO from(ClienteDocumento d) {
        return new ClienteDocumentoDTO(
                d.getId(),
                d.getTipo(),
                d.getUrl(),
                d.getNombre(),
                d.getCreatedAt()
        );
    }
}
