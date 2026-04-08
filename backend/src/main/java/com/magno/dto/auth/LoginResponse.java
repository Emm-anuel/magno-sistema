package com.magno.dto.auth;

import com.magno.dto.usuario.UsuarioDTO;

public record LoginResponse(
        String token,
        UsuarioDTO usuario
) {}
