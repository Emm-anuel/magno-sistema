package com.magno.dto.cliente;

import com.magno.model.Cliente;

import java.time.OffsetDateTime;

/**
 * DTO liviano para listados de clientes.
 * El campo estadoCliente y tieneCreditoActivo se inyectan desde el servicio.
 */
public record ClienteResumenDTO(
        Long id,
        String numeroCliente,
        String nombre,
        String apellidoPaterno,
        String apellidoMaterno,
        String nombreCompleto,
        String celular,
        String curp,
        String estadoCivil,
        String negocioNombre,
        String negocioGiro,
        AsesorInfo asesor,
        SucursalInfo sucursal,
        Boolean activo,
        Boolean tieneCreditoActivo,
        String estadoCliente,   // ACTIVO | EN_MORA | SIN_CREDITO | INACTIVO
        OffsetDateTime createdAt,
        Boolean tieneCreditoDiarioEnProceso,
        Boolean tieneCreditoSemanalEnProceso
) {
    public record AsesorInfo(Long id, String nombreCompleto) {}
    public record SucursalInfo(Long id, String nombre) {}

    public static ClienteResumenDTO from(Cliente c, boolean tieneCreditoActivo,
            boolean tieneCreditoDiarioEnProceso, boolean tieneCreditoSemanalEnProceso) {
        AsesorInfo asesorInfo = c.getAsesor() != null
                ? new AsesorInfo(c.getAsesor().getId(), c.getAsesor().getNombreCompleto())
                : null;

        SucursalInfo sucursalInfo = new SucursalInfo(
                c.getSucursal().getId(),
                c.getSucursal().getNombre()
        );

        String estado;
        if (!Boolean.TRUE.equals(c.getActivo())) {
            estado = "INACTIVO";
        } else if (!tieneCreditoActivo) {
            estado = "SIN_CREDITO";
        } else {
            estado = "ACTIVO";
        }

        return new ClienteResumenDTO(
                c.getId(),
                c.getNumeroCliente(),
                c.getNombre(),
                c.getApellidoPaterno(),
                c.getApellidoMaterno(),
                c.getNombreCompleto(),
                c.getCelular(),
                c.getCurp(),
                c.getEstadoCivil(),
                c.getNegocioNombre(),
                c.getNegocioGiro(),
                asesorInfo,
                sucursalInfo,
                c.getActivo(),
                tieneCreditoActivo,
                estado,
                c.getCreatedAt(),
                tieneCreditoDiarioEnProceso,
                tieneCreditoSemanalEnProceso
        );
    }
}
