package com.magno.controller;

import com.magno.dto.usuario.UsuarioCreateRequest;
import com.magno.dto.usuario.UsuarioDTO;
import com.magno.dto.usuario.UsuarioUpdateRequest;
import com.magno.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    /** GET /api/usuarios?rol=&sucursalId=&activo=&page=0&size=20 */
    @GetMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<Page<UsuarioDTO>> listar(
            @RequestParam(required = false) String rol,
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("nombreCompleto"));
        return ResponseEntity.ok(usuarioService.listar(rol, sucursalId, activo, pageable));
    }

    /** GET /api/usuarios/{id} */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<UsuarioDTO> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.obtener(id));
    }

    /** POST /api/usuarios */
    @PostMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<UsuarioDTO> crear(
            @Valid @RequestBody UsuarioCreateRequest req,
            Authentication auth) {
        UsuarioDTO creado = usuarioService.crear(req, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    /** PUT /api/usuarios/{id} */
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<UsuarioDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody UsuarioUpdateRequest req) {
        return ResponseEntity.ok(usuarioService.actualizar(id, req));
    }

    /** PATCH /api/usuarios/{id}/estado  body: { "activo": true/false } */
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<UsuarioDTO> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        Boolean activo = body.get("activo");
        if (activo == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(usuarioService.cambiarEstado(id, activo));
    }
}
