package com.magno.controller;

import com.magno.dto.caja.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.CajaService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/caja")
public class CajaController {

    private final CajaService cajaService;

    public CajaController(CajaService cajaService) {
        this.cajaService = cajaService;
    }

    // ── Apertura ──────────────────────────────────────────────────────────

    @PostMapping("/abrir")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CajaDiaDetalleDTO> abrir(
            @Valid @RequestBody AbrirCajaRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cajaService.abrir(req, principal(auth)));
    }

    // ── Cierre ────────────────────────────────────────────────────────────

    @PostMapping("/cerrar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CajaDiaDetalleDTO> cerrar(
            @RequestBody(required = false) CerrarCajaRequest req,
            Authentication auth) {
        CerrarCajaRequest effectiveReq = req != null ? req : new CerrarCajaRequest(null, null);
        return ResponseEntity.ok(cajaService.cerrar(effectiveReq, principal(auth)));
    }

    @PostMapping("/{cajaId}/cancelar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CajaDiaDetalleDTO> cancelar(
            @PathVariable Long cajaId,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.cancelarCierre(cajaId, principal(auth)));
    }

    // ── Estado / operativa ────────────────────────────────────────────────

    @GetMapping("/estado")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CajaEstadoDTO> estado(
            @RequestParam(required = false) Long sucursalId,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.getEstado(sucursalId, principal(auth)));
    }

    @GetMapping("/operativa")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CajaOperativaDTO> operativa(
            @RequestParam(required = false) Long sucursalId,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.getOperativa(sucursalId, principal(auth)));
    }

    // ── Historial ─────────────────────────────────────────────────────────

    @GetMapping("/historial")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CajaDiaDetalleDTO> historial(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.getHistorial(sucursalId, fecha, principal(auth)));
    }

    @GetMapping("/historial/lista")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<List<CajaDiaResumenDTO>> historialLista(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.getHistorialLista(sucursalId, desde, hasta, principal(auth)));
    }

    // ── Preview cierre ────────────────────────────────────────────────────

    @GetMapping("/cierre-preview")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CajaCierrePreviewDTO> cierrePreview(
            @RequestParam(required = false) Long sucursalId,
            Authentication auth) {
        return ResponseEntity.ok(cajaService.getPreviewCierre(sucursalId, principal(auth)));
    }

    // ── PDF ───────────────────────────────────────────────────────────────

    @GetMapping("/{cajaId}/pdf")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<byte[]> exportarPdf(
            @PathVariable Long cajaId,
            Authentication auth) {
        byte[] pdf = cajaService.exportarPdf(cajaId, principal(auth));
        String filename = "corte-caja-" + cajaId + ".pdf";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }
}
