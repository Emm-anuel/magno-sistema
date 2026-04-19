package com.magno.controller;

import com.magno.dto.renovacion.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.RenovacionService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/renovaciones")
public class RenovacionController {

    private final RenovacionService renovacionService;

    public RenovacionController(RenovacionService renovacionService) {
        this.renovacionService = renovacionService;
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/calcular?creditoId=X&montoNuevo=Y
    // Preview en tiempo real para el formulario (mismo patrón que /creditos/calcular)
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/calcular")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RenovacionCalculoDTO> calcular(
            @RequestParam Long creditoId,
            @RequestParam BigDecimal montoNuevo) {

        if (montoNuevo.compareTo(BigDecimal.valueOf(1000)) < 0) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(renovacionService.calcularPreview(creditoId, montoNuevo));
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/renovaciones — Confirmar renovación
    // Todos los roles pueden crear renovaciones (asesor: solo sus clientes)
    // ────────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RenovacionDetalleDTO> crear(
            @Valid @RequestBody RenovacionCreateRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(renovacionService.procesarRenovacion(req, p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/colocaciones?semanaInicio=2026-04-14&asesorId=X&sucursalId=Y
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/colocaciones")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ColocacionesSemanaDTO> colocaciones(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate semanaInicio,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        LocalDate inicio = resolveSemanaInicio(semanaInicio);

        // Restricciones por rol
        Long effectiveAsesorId = asesorId;
        Long effectiveSucursalId = sucursalId;
        switch (p.rol()) {
            case "ASESOR_COBRADOR" -> effectiveAsesorId = p.userId();
            case "SUPERVISOR_CAMPO" -> effectiveSucursalId = p.sucursalId();
        }

        return ResponseEntity.ok(
                renovacionService.getColocaciones(inicio, effectiveAsesorId, effectiveSucursalId));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/colocaciones/pdf
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/colocaciones/pdf")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> colocacionesPdf(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate semanaInicio,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        LocalDate inicio = resolveSemanaInicio(semanaInicio);

        Long effectiveAsesorId = asesorId;
        Long effectiveSucursalId = sucursalId;
        switch (p.rol()) {
            case "ASESOR_COBRADOR" -> effectiveAsesorId = p.userId();
            case "SUPERVISOR_CAMPO" -> effectiveSucursalId = p.sucursalId();
        }

        byte[] pdf = renovacionService.exportarPdf(inicio, effectiveAsesorId, effectiveSucursalId);

        String filename = "colocaciones-" + inicio + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(pdf);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/listos?asesorId=X&sucursalId=Y
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/listos")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ListoRenovarItemDTO>> getListos(
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            @AuthenticationPrincipal JwtPrincipal p) {

        Long effectiveAsesorId = asesorId;
        Long effectiveSucursalId = sucursalId;

        switch (p.rol()) {
            case "ASESOR_COBRADOR" -> effectiveAsesorId = p.userId();
            case "SUPERVISOR_CAMPO" -> effectiveSucursalId = p.sucursalId();
        }

        return ResponseEntity.ok(renovacionService.getListosParaRenovar(effectiveAsesorId, effectiveSucursalId));
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }

    private LocalDate resolveSemanaInicio(LocalDate requested) {
        if (requested != null) return RenovacionService.lunesDe(requested);
        return RenovacionService.lunesDe(com.magno.util.DateTimeUtils.hoyEnMagno());
    }
}
