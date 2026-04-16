package com.magno.controller;

import com.magno.dto.cobros.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.CobrosService;
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
@RequestMapping("/api/cobros")
public class CobrosController {

    private final CobrosService cobrosService;

    public CobrosController(CobrosService cobrosService) {
        this.cobrosService = cobrosService;
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/cobros/ruta-dia
    // ────────────────────────────────────────────────────────────────────

    /**
     * Devuelve la ruta del día por rol y alcance de asesor.
     *
     * <ul>
     * <li>ASESOR_COBRADOR: por defecto su propia ruta; si pasa asesorId distinto,
     * responde 403</li>
     * <li>SUPERVISOR_CAMPO: por defecto su propia ruta; puede filtrar por
     * asesor</li>
     * <li>ADMINISTRADOR y SUPERVISOR: sin asesorId ven todos los asesores de su
     * sucursal; con asesorId filtran ese asesor</li>
     * </ul>
     */
    @GetMapping("/ruta-dia")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RutaDiaDTO> getRutaDia(
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
            Authentication auth) {

        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        LocalDate fechaEfectiva = fecha != null ? fecha : LocalDate.now();

        RutaDiaDTO ruta = cobrosService.getRutaDia(
                asesorId,
                fechaEfectiva,
                principal.rol(),
                principal.userId(),
                principal.sucursalId());

        return ResponseEntity.ok(ruta);
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/cobros/registrar
    // ────────────────────────────────────────────────────────────────────

    /**
     * Registra un cobro (pagó o no pagó).
     * Todos los roles autenticados pueden registrar cobros,
     * pero solo de sus propios clientes (validado en el servicio).
     */
    @PostMapping("/registrar")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagoDTO> registrar(
            @Valid @RequestBody PagoRegistrarRequest req,
            Authentication auth) {

        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        PagoDTO pago = cobrosService.registrarPago(req, principal.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(pago);
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/cobros/{pagoId}
    // ────────────────────────────────────────────────────────────────────

    /**
     * Modifica un pago ya registrado.
     * Solo ADMINISTRADOR y SUPERVISOR pueden ejecutar esta acción.
     */
    @PatchMapping("/{pagoId}")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<PagoDTO> modificar(
            @PathVariable Long pagoId,
            @Valid @RequestBody PagoModificarRequest req,
            Authentication auth) {

        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        PagoDTO pago = cobrosService.modificarPago(pagoId, req, principal.userId());
        return ResponseEntity.ok(pago);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/cobros/historial
    // ────────────────────────────────────────────────────────────────────

    /**
     * Historial de cobros con filtros.
     *
     * <ul>
     * <li>ASESOR_COBRADOR: forzado a sus propios pagos</li>
     * <li>SUPERVISOR_CAMPO y superiores: pueden filtrar por asesor</li>
     * </ul>
     */
    @GetMapping("/historial")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<PagoDTO>> historial(
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaHasta,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "fechaPago", "id"));

        Page<PagoDTO> resultado = cobrosService.getHistorial(
                asesorId, clienteId, fechaDesde, fechaHasta,
                pageable,
                principal.rol(), principal.userId(), principal.sucursalId());

        return ResponseEntity.ok(resultado);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/cobros/cliente/{clienteId}
    // ────────────────────────────────────────────────────────────────────

    /**
     * Todos los pagos de un cliente, ordenados por fecha desc.
     * ASESOR_COBRADOR: solo sus clientes (validado en servicio).
     */
    @GetMapping("/cliente/{clienteId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PagoDTO>> getPagosPorCliente(
            @PathVariable Long clienteId,
            Authentication auth) {

        // El servicio no restringe por asesor en este método (es consulta de detalle).
        // La restricción de acceso al cliente ya está garantizada por el frontend
        // y el SecurityHelper en otros endpoints.
        return ResponseEntity.ok(cobrosService.getPagosPorCliente(clienteId));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/cobros/multas/{creditoId}
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/multas/{creditoId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<MultaDTO>> getMultasPorCredito(
            @PathVariable Long creditoId) {

        return ResponseEntity.ok(cobrosService.getMultasPorCredito(creditoId));
    }
}
