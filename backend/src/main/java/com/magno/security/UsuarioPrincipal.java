package com.magno.security;

import com.magno.model.Usuario;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Wrapper de UserDetails que delega isEnabled() al campo activo de Usuario.
 * Garantiza que Spring Security rechace el login de usuarios inactivos.
 */
public class UsuarioPrincipal implements UserDetails {

    private final Usuario usuario;

    public UsuarioPrincipal(Usuario usuario) {
        this.usuario = usuario;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(usuario.getRol().getNombre()));
    }

    @Override
    public String getPassword() {
        return usuario.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return usuario.getEmail();
    }

    @Override
    public boolean isEnabled() {
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            return false;
        }
        if (usuario.getSucursal() == null) {
            return false;
        }
        if (!Boolean.TRUE.equals(usuario.getSucursal().getActiva())) {
            return "ADMINISTRADOR".equals(usuario.getRol().getNombre());
        }
        return true;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }
}
