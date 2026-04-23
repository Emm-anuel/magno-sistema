package com.magno.dto.admin;

import com.magno.model.ConceptoInversion;

public record ConceptoInversionDTO(
        Long id,
        Long sucursalId,
        String nombre
) {
    public static ConceptoInversionDTO from(ConceptoInversion c) {
        return new ConceptoInversionDTO(c.getId(), c.getSucursalId(), c.getNombre());
    }
}
