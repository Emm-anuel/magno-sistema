package com.magno.controller;

import com.magno.dto.admin.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.AdministracionService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR', 'SUPERVISOR')")
public class AdministracionController {

    private final AdministracionService adminService;

    public AdministracionController(AdministracionService adminService) {
        this.adminService = adminService;
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG GENERAL DE SUCURSAL
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/config")
    public ResponseEntity<ConfigSucursalDTO> getConfig(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getConfigSucursal(sucursalId));
    }

    @PutMapping("/sucursales/{sucursalId}/config")
    public ResponseEntity<ConfigSucursalDTO> saveConfig(
            @PathVariable Long sucursalId,
            @Valid @RequestBody ConfigSucursalRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.saveConfigSucursal(sucursalId, req, uid(auth)));
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG MULTAS
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/multas")
    public ResponseEntity<List<ConfigMultaAdminDTO>> getMultas(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getMultas(sucursalId));
    }

    @PutMapping("/sucursales/{sucursalId}/multas")
    public ResponseEntity<List<ConfigMultaAdminDTO>> saveMultas(
            @PathVariable Long sucursalId,
            @Valid @RequestBody ConfigMultaListRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.saveMultas(sucursalId, req, uid(auth)));
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG RANGOS DE CRÉDITO
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/rangos")
    public ResponseEntity<List<ConfigRangoCreditoDTO>> getRangos(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getRangos(sucursalId));
    }

    @PutMapping("/sucursales/{sucursalId}/rangos")
    public ResponseEntity<List<ConfigRangoCreditoDTO>> saveRangos(
            @PathVariable Long sucursalId,
            @Valid @RequestBody ConfigRangoCreditoRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.saveRangos(sucursalId, req, uid(auth)));
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG UMBRALES DE RENOVACIÓN
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/umbrales")
    public ResponseEntity<List<ConfigUmbralRenovacionDTO>> getUmbrales(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getUmbrales(sucursalId));
    }

    @PutMapping("/sucursales/{sucursalId}/umbrales")
    public ResponseEntity<List<ConfigUmbralRenovacionDTO>> saveUmbrales(
            @PathVariable Long sucursalId,
            @Valid @RequestBody ConfigUmbralRenovacionRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.saveUmbrales(sucursalId, req, uid(auth)));
    }

    // ─────────────────────────────────────────────────────────────────
    // NÓMINA DE PERSONAL
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/nomina")
    public ResponseEntity<List<NominaPersonalDTO>> getNomina(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getNomina(sucursalId));
    }

    @PostMapping("/sucursales/{sucursalId}/nomina")
    public ResponseEntity<NominaPersonalDTO> crearNomina(
            @PathVariable Long sucursalId,
            @Valid @RequestBody NominaPersonalRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminService.crearNomina(sucursalId, req, uid(auth)));
    }

    @PutMapping("/sucursales/{sucursalId}/nomina/{id}")
    public ResponseEntity<NominaPersonalDTO> actualizarNomina(
            @PathVariable Long sucursalId,
            @PathVariable Long id,
            @Valid @RequestBody NominaPersonalRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.actualizarNomina(sucursalId, id, req, uid(auth)));
    }

    @DeleteMapping("/sucursales/{sucursalId}/nomina/{id}")
    public ResponseEntity<Void> eliminarNomina(
            @PathVariable Long sucursalId,
            @PathVariable Long id,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        adminService.eliminarNomina(sucursalId, id, uid(auth));
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────
    // CONCEPTOS DE INVERSIÓN
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/sucursales/{sucursalId}/conceptos")
    public ResponseEntity<List<ConceptoInversionDTO>> getConceptos(@PathVariable Long sucursalId,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.getConceptos(sucursalId));
    }

    @PostMapping("/sucursales/{sucursalId}/conceptos")
    public ResponseEntity<ConceptoInversionDTO> crearConcepto(
            @PathVariable Long sucursalId,
            @Valid @RequestBody ConceptoInversionRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminService.crearConcepto(sucursalId, req, uid(auth)));
    }

    @PutMapping("/sucursales/{sucursalId}/conceptos/{id}")
    public ResponseEntity<ConceptoInversionDTO> actualizarConcepto(
            @PathVariable Long sucursalId,
            @PathVariable Long id,
            @Valid @RequestBody ConceptoInversionRequest req,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        return ResponseEntity.ok(adminService.actualizarConcepto(sucursalId, id, req, uid(auth)));
    }

    @DeleteMapping("/sucursales/{sucursalId}/conceptos/{id}")
    public ResponseEntity<Void> eliminarConcepto(
            @PathVariable Long sucursalId,
            @PathVariable Long id,
            Authentication auth) {
        validarAccesoSucursal(sucursalId, auth);
        adminService.eliminarConcepto(sucursalId, id, uid(auth));
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────
    // DÍAS INHÁBILES (globales)
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/dias-inhabiles")
    public ResponseEntity<List<DiaFestivoAdminDTO>> getDiasInhabiles() {
        return ResponseEntity.ok(adminService.getDiasInhabiles());
    }

    @PostMapping("/dias-inhabiles")
    public ResponseEntity<DiaFestivoAdminDTO> crearDiaInhabil(
            @Valid @RequestBody DiaFestivoAdminRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminService.crearDiaInhabil(req, uid(auth)));
    }

    @PutMapping("/dias-inhabiles/{id}")
    public ResponseEntity<DiaFestivoAdminDTO> actualizarDiaInhabil(
            @PathVariable Long id,
            @Valid @RequestBody DiaFestivoAdminRequest req,
            Authentication auth) {
        return ResponseEntity.ok(adminService.actualizarDiaInhabil(id, req, uid(auth)));
    }

    @DeleteMapping("/dias-inhabiles/{id}")
    public ResponseEntity<Void> eliminarDiaInhabil(
            @PathVariable Long id,
            Authentication auth) {
        adminService.eliminarDiaInhabil(id, uid(auth));
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────
    // BITÁCORA DE CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/bitacora")
    public ResponseEntity<Page<BitacoraConfigDTO>> getBitacora(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) String seccion,
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            Authentication auth) {
        JwtPrincipal p = (JwtPrincipal) auth.getPrincipal();
        // SUPERVISOR solo puede ver registros de su sucursal
        Long sucursalFiltro = "SUPERVISOR".equals(p.rol()) ? p.sucursalId() : sucursalId;
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.getBitacora(sucursalFiltro, seccion, usuarioId, desde, hasta, pageable));
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    private Long uid(Authentication auth) {
        return ((JwtPrincipal) auth.getPrincipal()).userId();
    }

    /** SUPERVISOR solo puede operar sobre su propia sucursal. */
    private void validarAccesoSucursal(Long sucursalId, Authentication auth) {
        JwtPrincipal p = (JwtPrincipal) auth.getPrincipal();
        if ("SUPERVISOR".equals(p.rol()) && !sucursalId.equals(p.sucursalId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "Solo puedes acceder a la configuración de tu sucursal");
        }
    }
}
