package com.magno.controller;

import com.magno.dto.auth.LoginRequest;
import com.magno.dto.auth.LoginResponse;
import com.magno.dto.usuario.UsuarioDTO;
import com.magno.repository.UsuarioRepository;
import com.magno.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepo;

    public AuthController(AuthenticationManager authManager,
                          JwtService jwtService,
                          UsuarioRepository usuarioRepo) {
        this.authManager = authManager;
        this.jwtService = jwtService;
        this.usuarioRepo = usuarioRepo;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            Authentication auth = authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );

            // Cargar datos completos del usuario
            var usuario = usuarioRepo.findByEmail(auth.getName())
                    .orElseThrow();

            String token = jwtService.generate(
                    usuario.getId(),
                    usuario.getEmail(),
                    usuario.getRol().getNombre(),
                    usuario.getSucursal().getId()
            );

            return ResponseEntity.ok(new LoginResponse(token, UsuarioDTO.from(usuario)));

        } catch (DisabledException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "El usuario está inactivo"));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Credenciales incorrectas"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwtService.blacklist(header.substring(7));
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UsuarioDTO> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return usuarioRepo.findByEmail(auth.getName())
                .map(u -> ResponseEntity.ok(UsuarioDTO.from(u)))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
}
