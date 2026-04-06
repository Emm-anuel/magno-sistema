package com.magno.controller;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (!"admin@magno.com".equalsIgnoreCase(request.email()) || !"Admin@2024".equals(request.password())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Credenciales incorrectas",
                    "timestamp", Instant.now().toString()));
        }

        Map<String, Object> sucursal = Map.of(
                "id", 1,
                "nombre", "Sucursal Centro",
                "direccion", "Av. Principal 123",
                "telefono", "5550000000",
                "multa_base", 50,
                "ahorro_diario", 2000,
                "activa", true);

        Map<String, Object> usuario = Map.of(
                "id", 1,
                "nombre_completo", "Administrador MAGNO",
                "email", "admin@magno.com",
                "telefono", "5550000000",
                "rol", "ADMINISTRADOR",
                "sucursal", sucursal,
                "activo", true);

        return ResponseEntity.ok(Map.of(
                "token", "dev-token-admin",
                "usuario", usuario));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    public record LoginRequest(String email, String password) {
    }
}