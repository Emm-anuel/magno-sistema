package com.magno.controller;

import com.magno.dto.dashboard.DashboardResponseDTO;
import com.magno.security.JwtPrincipal;
import com.magno.service.DashboardService;
import com.magno.util.DateTimeUtils;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public ResponseEntity<DashboardResponseDTO> getDashboard(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {

        JwtPrincipal principal = principal(auth);
        Long effectiveSucursalId = resolveSucursalId(sucursalId, principal);
        Long effectiveAsesorId = resolveAsesorId(asesorId, principal);
        LocalDate hoy = DateTimeUtils.hoyEnMagno();

        LocalDate desdeSafe = desde != null ? desde : hoy;
        LocalDate hastaSafe = hasta != null ? hasta : hoy;

        return ResponseEntity.ok(
                dashboardService.getDashboard(
                        effectiveSucursalId,
                        effectiveAsesorId,
                        desdeSafe,
                        hastaSafe,
                        principal));
    }

    private Long resolveSucursalId(Long requestId, JwtPrincipal principal) {
        if ("ADMINISTRADOR".equals(principal.rol())) {
            if (requestId != null) {
                return requestId;
            }
            if (principal.sucursalId() != null) {
                return principal.sucursalId();
            }
            throw new IllegalArgumentException("sucursalId es requerido para el rol ADMINISTRADOR");
        }
        return principal.sucursalId();
    }

    private Long resolveAsesorId(Long requestId, JwtPrincipal principal) {
        return switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> principal.userId();
            case "SUPERVISOR", "SUPERVISOR_CAMPO", "ADMINISTRADOR" -> requestId;
            default -> requestId;
        };
    }

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }
}
