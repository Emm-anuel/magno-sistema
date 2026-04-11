package com.magno.security;

/**
 * Principal ligero derivado de los claims del JWT.
 * Evita una consulta a BD por cada request; los datos de sesión
 * provienen directamente del token firmado (userId, rol, sucursalId).
 *
 * Implementa {@link java.security.Principal} para que
 * {@code Authentication.getName()} devuelva el email correctamente.
 */
public record JwtPrincipal(
        Long   userId,
        String email,
        String rol,
        Long   sucursalId
) implements java.security.Principal {

    @Override
    public String getName() {
        return email;
    }
}
