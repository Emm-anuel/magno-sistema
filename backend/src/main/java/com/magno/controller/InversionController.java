package com.magno.controller;

import com.magno.dto.caja.MovimientoInversionDTO;
import com.magno.dto.caja.MovimientoInversionRequest;
import com.magno.security.JwtPrincipal;
import com.magno.service.InversionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inversiones")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public class InversionController {

    private final InversionService inversionService;

    public InversionController(InversionService inversionService) {
        this.inversionService = inversionService;
    }

    @GetMapping
    public ResponseEntity<List<MovimientoInversionDTO>> getInversiones(
            @RequestParam Long cajaId,
            Authentication auth) {
        return ResponseEntity.ok(inversionService.getByDia(cajaId, principal(auth)));
    }

    @PostMapping
    public ResponseEntity<MovimientoInversionDTO> registrar(
            @RequestParam Long cajaId,
            @Valid @RequestBody MovimientoInversionRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inversionService.registrar(cajaId, req, principal(auth)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @RequestParam Long cajaId,
            @PathVariable Long id,
            Authentication auth) {
        inversionService.eliminar(cajaId, id, principal(auth));
        return ResponseEntity.noContent().build();
    }

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }
}
