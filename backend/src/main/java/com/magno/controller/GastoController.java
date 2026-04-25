package com.magno.controller;

import com.magno.dto.gasto.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.GastoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gastos")
public class GastoController {

    private final GastoService gastoService;

    public GastoController(GastoService gastoService) {
        this.gastoService = gastoService;
    }

    // GET /api/gastos?cajaId=
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<GastosDelDiaDTO> getGastos(
            @RequestParam Long cajaId) {
        return ResponseEntity.ok(gastoService.getGastos(cajaId));
    }

    // POST /api/gastos?cajaId=
    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<GastoDTO> registrar(
            @RequestParam Long cajaId,
            @Valid @RequestBody GastoCreateRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(gastoService.registrarGasto(cajaId, req, principal(auth).userId()));
    }

    // PUT /api/gastos/{id}
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<GastoDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody GastoUpdateRequest req,
            Authentication auth) {
        return ResponseEntity.ok(gastoService.actualizarGasto(id, req, principal(auth).userId()));
    }

    // DELETE /api/gastos/{id}
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<Void> eliminar(
            @PathVariable Long id) {
        gastoService.eliminarGasto(id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/gastos/categorias?sucursalId=
    @GetMapping("/categorias")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<List<CategoriaGastoDTO>> getCategorias(
            @RequestParam Long sucursalId) {
        return ResponseEntity.ok(gastoService.getCategorias(sucursalId));
    }

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }
}
