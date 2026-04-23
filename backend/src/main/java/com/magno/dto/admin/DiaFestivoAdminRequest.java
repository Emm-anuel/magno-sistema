package com.magno.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record DiaFestivoAdminRequest(
        @NotNull LocalDate fecha,
        @NotBlank String descripcion
) {}
