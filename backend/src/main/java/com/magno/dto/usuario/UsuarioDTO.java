package com.magno.dto.usuario;

import com.magno.model.Usuario;

import java.math.BigDecimal;

/**
 * Respuesta pública del usuario — nunca incluye password_hash.
 * Los nombres de campo en camelCase se serializar a snake_case via Jackson SNAKE_CASE strategy.
 */
public record UsuarioDTO(
        Long id,
        String nombreCompleto,
        String email,
        String telefono,
        String rol,
        SucursalInfo sucursal,
        Boolean activo,
        String ineNumero,
        String ineImagenUrl,
        // Domicilio
        String calle,
        String noExterior,
        String noInterior,
        String colonia,
        String municipio,
        String estado,
        String codigoPostal,
        // Referencias
        String ref1Nombre,
        String ref1Telefono,
        String ref1Parentesco,
        String ref2Nombre,
        String ref2Telefono,
        String ref2Parentesco
) {

    public record SucursalInfo(
            Long id,
            String nombre,
            String direccion,
            String telefono,
            BigDecimal multaBase,
            BigDecimal ahorroDiario,
            Boolean activa
    ) {}

    /** Convierte una entidad Usuario a DTO. */
    public static UsuarioDTO from(Usuario u) {
        SucursalInfo s = new SucursalInfo(
                u.getSucursal().getId(),
                u.getSucursal().getNombre(),
                u.getSucursal().getDireccion(),
                u.getSucursal().getTelefono(),
                u.getSucursal().getMultaBase(),
                u.getSucursal().getAhorroDiario(),
                u.getSucursal().getActiva()
        );
        return new UsuarioDTO(
                u.getId(),
                u.getNombreCompleto(),
                u.getEmail(),
                u.getTelefono(),
                u.getRol().getNombre(),
                s,
                u.getActivo(),
                u.getIneNumero(),
                u.getIneImagenUrl(),
                u.getCalle(),
                u.getNoExterior(),
                u.getNoInterior(),
                u.getColonia(),
                u.getMunicipio(),
                u.getEstado(),
                u.getCodigoPostal(),
                u.getRef1Nombre(),
                u.getRef1Telefono(),
                u.getRef1Parentesco(),
                u.getRef2Nombre(),
                u.getRef2Telefono(),
                u.getRef2Parentesco()
        );
    }
}
