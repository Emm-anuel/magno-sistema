package com.magno.dto.admin;

import jakarta.validation.constraints.NotBlank;

public record ConceptoInversionRequest(
        @NotBlank String nombre
) {}
