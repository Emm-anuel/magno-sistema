package com.magno.controller;

import com.magno.dto.sucursal.SucursalCreateRequest;
import com.magno.dto.sucursal.SucursalDTO;
import com.magno.dto.sucursal.SucursalUpdateRequest;
import com.magno.service.SucursalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sucursales")
public class SucursalController {

    private final SucursalService sucursalService;

    public SucursalController(SucursalService sucursalService) {
        this.sucursalService = sucursalService;
    }

    @GetMapping
    public ResponseEntity<List<SucursalDTO>> listarActivas() {
        return ResponseEntity.ok(sucursalService.listarActivas());
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<List<SucursalDTO>> listarTodas() {
        return ResponseEntity.ok(sucursalService.listarTodas());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<SucursalDTO> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(sucursalService.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<SucursalDTO> crear(@Valid @RequestBody SucursalCreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sucursalService.crear(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<SucursalDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody SucursalUpdateRequest req) {
        return ResponseEntity.ok(sucursalService.actualizar(id, req));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<SucursalDTO> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        Boolean activa = body.get("activa");
        if (activa == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(sucursalService.cambiarEstado(id, activa));
    }
}
