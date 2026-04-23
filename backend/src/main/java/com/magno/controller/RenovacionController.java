package com.magno.controller;

import com.magno.dto.renovacion.*;
import com.magno.model.TipoPago;
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
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/calcular")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RenovacionCalculoDTO> calcular(
            @RequestParam Long creditoId,
            @RequestParam BigDecimal montoNuevo,
            @RequestParam(required = false) TipoPago tipoPago) {

        if (montoNuevo.compareTo(BigDecimal.valueOf(1000)) < 0) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(renovacionService.calcularPreview(creditoId, montoNuevo, tipoPago));
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/renovaciones — Crear solicitud (estado SOLICITADO)
    // Solo SUPERVISOR_CAMPO y ASESOR_COBRADOR pueden crear solicitudes.
    // Gerentes solo revisan y aprueban/rechazan.
    // ────────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyAuthority('SUPERVISOR_CAMPO','ASESOR_COBRADOR')")
    public ResponseEntity<RenovacionDetalleDTO> crear(
            @Valid @RequestBody RenovacionCreateRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(renovacionService.crearSolicitud(req, p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/renovaciones/{id}/aprobar
    // Solo ADMINISTRADOR y SUPERVISOR — guarda montoAprobado, NO toca créditos
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/aprobar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<RenovacionDetalleDTO> aprobar(
            @PathVariable Long id,
            @RequestBody(required = false) RenovacionAprobarRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        java.math.BigDecimal montoAprobado = (req != null) ? req.montoAprobado() : null;
        return ResponseEntity.ok(renovacionService.aprobarRenovacion(id, montoAprobado, p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/renovaciones/{id}/confirmar-desembolso
    // Todos los roles — confirma entrega del efectivo; activa el crédito
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/confirmar-desembolso")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RenovacionDetalleDTO> confirmarDesembolso(
            @PathVariable Long id,
            @RequestBody(required = false) RenovacionConfirmarDesembolsoRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        String videoUrl = (req != null) ? req.videoEntregaUrl() : null;
        return ResponseEntity.ok(renovacionService.confirmarDesembolso(id, p.userId(), videoUrl));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/pendientes-desembolso
    // Renovaciones APROBADAS pendientes — solo ADMINISTRADOR y SUPERVISOR
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/pendientes-desembolso")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<List<RenovacionDetalleDTO>> pendientesDesembolso(
            @AuthenticationPrincipal JwtPrincipal p) {

        Long effectiveSucursalId = null;
        if ("SUPERVISOR".equals(p.rol())) {
            effectiveSucursalId = p.sucursalId();
        }
        return ResponseEntity.ok(renovacionService.getPendientesDesembolso(effectiveSucursalId));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/renovaciones/{id}/rechazar
    // Solo ADMINISTRADOR y SUPERVISOR
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/rechazar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<RenovacionDetalleDTO> rechazar(
            @PathVariable Long id,
            @RequestBody(required = false) RenovacionRechazarRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        String motivo = req != null ? req.motivo() : "";
        return ResponseEntity.ok(renovacionService.rechazarRenovacion(id, motivo, p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/mis-solicitudes
    // Solicitudes enviadas por el asesor autenticado
    // Solo SUPERVISOR_CAMPO y ASESOR_COBRADOR
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/mis-solicitudes")
    @PreAuthorize("hasAnyAuthority('SUPERVISOR_CAMPO','ASESOR_COBRADOR')")
    public ResponseEntity<List<RenovacionDetalleDTO>> misSolicitudes(
            @AuthenticationPrincipal JwtPrincipal p) {

        return ResponseEntity.ok(renovacionService.getMisSolicitudes(p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/pendientes
    // Cola de aprobación para ADMINISTRADOR y SUPERVISOR
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/pendientes")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<List<RenovacionDetalleDTO>> pendientes(
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            @AuthenticationPrincipal JwtPrincipal p) {

        // Gerente de Sucursal solo ve su propia sucursal
        Long effectiveSucursalId = sucursalId;
        if ("SUPERVISOR".equals(p.rol())) {
            effectiveSucursalId = p.sucursalId();
        }

        return ResponseEntity.ok(renovacionService.getPendientes(asesorId, effectiveSucursalId));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/colocaciones
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
    // GET /api/renovaciones/listos
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
        if (requested != null)
            return RenovacionService.lunesDe(requested);
        return RenovacionService.lunesDe(com.magno.util.DateTimeUtils.hoyEnMagno());
    }
}
