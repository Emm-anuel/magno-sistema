package com.magno.dto.reporte;

import java.util.List;

public record ReporteClientesDTO(
        List<ClienteItemDTO> clientes,
        int total,
        int totalActivos,
        int totalEnMora,
        int totalSinCredito,
        int totalInactivos
) {
    public record ClienteItemDTO(
            Long   id,
            String numeroCliente,
            String nombreCompleto,
            String celular,
            String curp,
            String negocioNombre,
            String negocioGiro,
            String asesorNombre,
            String estadoCliente,   // ACTIVO | EN_MORA | SIN_CREDITO | INACTIVO
            String fechaAlta
    ) {}
}
