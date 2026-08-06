package com.magno.dto.usuario;

import com.magno.model.Usuario;
import java.time.LocalDate;

import java.util.List;

/**
 * Respuesta pública del usuario — nunca incluye password_hash.
 */
public record UsuarioDTO(
                Long id,
                String nombreCompleto,
                String email,
                String telefono,
                LocalDate fechaNacimiento,
                LocalDate fechaIngreso,
                String rol,
                SucursalInfo sucursal,
                List<SucursalInfo> sucursalesAdicionales,
                Boolean activo,
                String ineNumero,
                String ineImagenUrl,
                String ineImagenReversoUrl,
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
                String ref2Parentesco) {

        public record SucursalInfo(
                        Long id,
                        String nombre,
                        String direccion,
                        String telefono,
                        Boolean activa) {

                /** Convierte una entidad Sucursal a su representación resumida. */
                public static SucursalInfo from(com.magno.model.Sucursal s) {
                        return new SucursalInfo(s.getId(), s.getNombre(), s.getDireccion(), s.getTelefono(), s.getActiva());
                }
        }

        /** Convierte una entidad Usuario a DTO. */
        public static UsuarioDTO from(Usuario u) {
                SucursalInfo s = SucursalInfo.from(u.getSucursal());
                List<SucursalInfo> adicionales = u.getSucursalesAdicionales().stream()
                                .map(SucursalInfo::from)
                                .toList();
                return new UsuarioDTO(
                                u.getId(),
                                u.getNombreCompleto(),
                                u.getEmail(),
                                u.getTelefono(),
                                u.getFechaNacimiento(),
                                u.getFechaIngreso(),
                                u.getRol().getNombre(),
                                s,
                                adicionales,
                                u.getActivo(),
                                u.getIneNumero(),
                                u.getIneImagenUrl(),
                                u.getIneImagenReversoUrl(),
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
                                u.getRef2Parentesco());
        }
}
