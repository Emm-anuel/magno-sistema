package com.magno.dto.sucursal;

import com.magno.model.Sucursal;

public record SucursalDTO(
        Long id,
        String nombre,
        String direccion,
        String telefono,
        Boolean activa) {
    public static SucursalDTO from(Sucursal s) {
        return new SucursalDTO(
                s.getId(),
                s.getNombre(),
                s.getDireccion(),
                s.getTelefono(),
                s.getActiva());
    }
}
