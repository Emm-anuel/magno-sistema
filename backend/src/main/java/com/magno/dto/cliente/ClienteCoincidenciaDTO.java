package com.magno.dto.cliente;

import java.time.LocalDate;
import java.util.List;

public record ClienteCoincidenciaDTO(
        Long id,
        String numeroCliente,
        String nombreCompleto,
        LocalDate fechaNacimiento,
        String celular,
        String asesorNombre,
        Long asesorId,
        String sucursalNombre,
        Long sucursalId,
        Boolean activo,
        Boolean tieneCreditoActivo,
        List<String> coincidencias
) {}
