package com.magno.controller;

import com.magno.dto.caja.NominaEstadoDTO;
import com.magno.dto.caja.NominaPagoDTO;
import com.magno.security.JwtPrincipal;
import com.magno.service.NominaCajaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/caja/{cajaDiaId}/nomina")
public class NominaCajaController {

    private final NominaCajaService nominaService;

    public NominaCajaController(NominaCajaService nominaService) {
        this.nominaService = nominaService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<NominaEstadoDTO> getEstado(
            @PathVariable Long cajaDiaId,
            Authentication auth) {
        JwtPrincipal p = (JwtPrincipal) auth.getPrincipal();
        return ResponseEntity.ok(nominaService.getEstado(cajaDiaId, p));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<NominaPagoDTO> registrarPago(
            @PathVariable Long cajaDiaId,
            Authentication auth) {
        JwtPrincipal p = (JwtPrincipal) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(nominaService.registrarPago(cajaDiaId, p.userId()));
    }

    @DeleteMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<Void> anularPago(@PathVariable Long cajaDiaId) {
        nominaService.anularPago(cajaDiaId);
        return ResponseEntity.noContent().build();
    }
}
