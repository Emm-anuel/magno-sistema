package com.magno.dto.admin;

import com.magno.model.DiaFestivo;

import java.time.LocalDate;

public record DiaFestivoAdminDTO(
        Long id,
        LocalDate fecha,
        String descripcion
) {
    public static DiaFestivoAdminDTO from(DiaFestivo d) {
        return new DiaFestivoAdminDTO(d.getId(), d.getFecha(), d.getDescripcion());
    }
}
