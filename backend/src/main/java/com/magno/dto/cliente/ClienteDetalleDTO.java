package com.magno.dto.cliente;

import com.magno.model.Cliente;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * DTO completo para la ficha de detalle de un cliente.
 */
public record ClienteDetalleDTO(
        Long id,

        // Datos personales
        String nombre,
        String apellidoPaterno,
        String apellidoMaterno,
        String nombreCompleto,
        LocalDate fechaNacimiento,
        String genero,
        String estadoCivil,
        String nombreConyuge,
        String telefonoFijo,
        String celular,

        // Identificación
        String ineTipo,
        String ineNumero,
        String curp,
        String rfc,

        // Domicilio
        String domCalle,
        String domNoExterior,
        String domNoInterior,
        String domColonia,
        String domMunicipio,
        String domEstado,
        String domCodigoPostal,
        String domTipoVivienda,
        BigDecimal domMontoRenta,

        // Negocio
        String negocioNombre,
        String negocioGiro,
        String negocioAntiguedad,
        String negocioDireccion,
        String negocioTipoLocal,
        BigDecimal negocioMontoRenta,
        String negocioHorarios,

        // Finanzas
        BigDecimal ingresosSemanales,
        BigDecimal gastosSemanales,
        BigDecimal gastosRenta,
        BigDecimal gastosOtros,

        // Referencias
        String ref1Nombre,
        String ref1Telefono,
        String ref1Parentesco,
        String ref2Nombre,
        String ref2Telefono,
        String ref2Parentesco,

        // Aval
        String avalNombre,
        String avalTelefono,
        String avalDireccion,
        String avalIdentificacion,

        // Relaciones
        AsesorInfo asesor,
        SucursalInfo sucursal,

        Boolean activo,
        String estadoCliente,
        Boolean tieneCreditoActivo,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public record AsesorInfo(Long id, String nombreCompleto, String rol) {}
    public record SucursalInfo(Long id, String nombre) {}

    public static ClienteDetalleDTO from(Cliente c, boolean tieneCreditoActivo) {
        AsesorInfo asesorInfo = null;
        if (c.getAsesor() != null) {
            asesorInfo = new AsesorInfo(
                    c.getAsesor().getId(),
                    c.getAsesor().getNombreCompleto(),
                    c.getAsesor().getRol().getNombre()
            );
        }

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

        return new ClienteDetalleDTO(
                c.getId(),
                c.getNombre(),
                c.getApellidoPaterno(),
                c.getApellidoMaterno(),
                c.getNombreCompleto(),
                c.getFechaNacimiento(),
                c.getGenero(),
                c.getEstadoCivil(),
                c.getNombreConyuge(),
                c.getTelefonoFijo(),
                c.getCelular(),
                c.getIneTipo(),
                c.getIneNumero(),
                c.getCurp(),
                c.getRfc(),
                c.getDomCalle(),
                c.getDomNoExterior(),
                c.getDomNoInterior(),
                c.getDomColonia(),
                c.getDomMunicipio(),
                c.getDomEstado(),
                c.getDomCodigoPostal(),
                c.getDomTipoVivienda(),
                c.getDomMontoRenta(),
                c.getNegocioNombre(),
                c.getNegocioGiro(),
                c.getNegocioAntiguedad(),
                c.getNegocioDireccion(),
                c.getNegocioTipoLocal(),
                c.getNegocioMontoRenta(),
                c.getNegocioHorarios(),
                c.getIngresosSemanales(),
                c.getGastosSemanales(),
                c.getGastosRenta(),
                c.getGastosOtros(),
                c.getRef1Nombre(),
                c.getRef1Telefono(),
                c.getRef1Parentesco(),
                c.getRef2Nombre(),
                c.getRef2Telefono(),
                c.getRef2Parentesco(),
                c.getAvalNombre(),
                c.getAvalTelefono(),
                c.getAvalDireccion(),
                c.getAvalIdentificacion(),
                asesorInfo,
                sucursalInfo,
                c.getActivo(),
                estado,
                tieneCreditoActivo,
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
