package com.magno.controller;

import com.magno.dto.credito.*;
import com.magno.model.EstadoCredito;
import com.magno.model.TipoPago;
import com.magno.security.CajaGuard;
import com.magno.security.JwtPrincipal;
import com.magno.security.SecurityHelper;
import com.magno.service.CreditoCalculoService;
import com.magno.service.CreditoService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/creditos")
public class CreditoController {

    private final CreditoService creditoService;
    private final CreditoCalculoService calculoService;
    private final SecurityHelper securityHelper;
    private final CajaGuard cajaGuard;

    public CreditoController(CreditoService creditoService,
            CreditoCalculoService calculoService,
            SecurityHelper securityHelper,
            CajaGuard cajaGuard) {
        this.creditoService = creditoService;
        this.calculoService = calculoService;
        this.securityHelper = securityHelper;
        this.cajaGuard = cajaGuard;
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/creditos — Listado con filtros
    // ────────────────────────────────────────────────────────────────────

    /**
     * Listado paginado de créditos.
     *
     * <ul>
     * <li>ASESOR_COBRADOR → solo sus créditos (filtrado por asesor_id)</li>
     * <li>SUPERVISOR_CAMPO → solo su sucursal</li>
     * <li>ADMINISTRADOR / SUPERVISOR → todos</li>
     * </ul>
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<CreditoResumenDTO>> listar(
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String buscar,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        EstadoCredito estadoEnum = parseEstado(estado);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        // Filtrado por rol — aplicar restricciones de sucursal/asesor según rol
        switch (p.rol()) {
            case "ASESOR_COBRADOR" -> asesorId = p.userId();
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> sucursalId = p.sucursalId();
        }

        return ResponseEntity.ok(
                creditoService.listar(clienteId, asesorId, sucursalId, estadoEnum, buscar, pageable));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/creditos/{id}
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CreditoDetalleDTO> obtener(@PathVariable Long id, Authentication auth) {
        CreditoDetalleDTO dto = creditoService.obtenerDetalle(id);

        JwtPrincipal p = principal(auth);
        verificarAcceso(dto, p);

        return ResponseEntity.ok(dto);
    }

    // ────────────────────────────────────────────────────────────────────
    // POST /api/creditos — Nueva solicitud
    // ────────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CreditoDetalleDTO> crear(
            @Valid @RequestBody CreditoCreateRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        cajaGuard.validarCajaAbierta(p);
        CreditoCreateRequest normalizado = normalizarCreate(req, p);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(creditoService.crearSolicitud(normalizado, p.userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/creditos/{id}/solicitud — Editar solicitud
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/solicitud")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CreditoDetalleDTO> actualizarSolicitud(
            @PathVariable Long id,
            @Valid @RequestBody CreditoActualizarSolicitudRequest req,
            Authentication auth) {

        return ResponseEntity.ok(
                creditoService.actualizarSolicitud(id, req, principal(auth).userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/creditos/{id}/aprobar
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/aprobar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CreditoDetalleDTO> aprobar(
            @PathVariable Long id,
            @Valid @RequestBody CreditoAprobarRequest req,
            Authentication auth) {

        return ResponseEntity.ok(
                creditoService.aprobarCredito(id, req, principal(auth).userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/creditos/{id}/activar
    // ────────────────────────────────────────────────────────────────────
    /**
     * Activar crédito aprobado: genera calendario de pagos y desembolsa.
     * Solo ADMINISTRADOR y SUPERVISOR pueden activar créditos.
     */
    @PatchMapping("/{id}/activar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CreditoDetalleDTO> activar(
            @PathVariable Long id,
            Authentication auth) {

        return ResponseEntity.ok(
                creditoService.activarCredito(id, principal(auth).userId()));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/creditos/{id}/video-entrega
    // ────────────────────────────────────────────────────────────────────
    /**
     * Subir video de entrega de dinero del crédito.
     * Validación de acceso: ASESOR_COBRADOR → solo sus créditos,
     * SUPERVISOR_CAMPO → solo su sucursal, ADMINISTRADOR/SUPERVISOR → todos.
     */
    @PatchMapping("/{id}/video-entrega")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CreditoDetalleDTO> subirVideo(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        String url = body.get("videoEntregaUrl");
        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // Verificar acceso al crédito
        CreditoDetalleDTO dto = creditoService.obtenerDetalle(id);
        JwtPrincipal p = principal(auth);
        verificarAcceso(dto, p);

        return ResponseEntity.ok(creditoService.subirVideoEntrega(id, url));
    }

    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/creditos/{id}/cancelar
    // ────────────────────────────────────────────────────────────────────
    /**
     * Cancelar crédito. Solo ADMINISTRADOR y SUPERVISOR pueden cancelar.
     */
    @PatchMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<CreditoDetalleDTO> cancelar(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        String motivo = body.getOrDefault("motivo", "");

        // Verificar acceso adicional (aunque el rol ya lo restringe)
        CreditoDetalleDTO dto = creditoService.obtenerDetalle(id);
        JwtPrincipal p = principal(auth);
        verificarAcceso(dto, p);

        return ResponseEntity.ok(creditoService.cancelarCredito(id, motivo));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/creditos/{id}/calendario
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/calendario")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<CalendarioPagoDTO>> calendario(@PathVariable Long id) {
        return ResponseEntity.ok(creditoService.getCalendario(id));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/creditos/cliente/{clienteId}
    // ────────────────────────────────────────────────────────────────────
    /**
     * Historial de créditos de un cliente.
     * Validación de acceso: ASESOR_COBRADOR → solo sus clientes,
     * SUPERVISOR_CAMPO → solo su sucursal, ADMINISTRADOR/SUPERVISOR → todos.
     */
    @GetMapping("/cliente/{clienteId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<CreditoResumenDTO>> porCliente(
            @PathVariable Long clienteId,
            Authentication auth) {

        securityHelper.esMiCliente(clienteId, auth);
        return ResponseEntity.ok(creditoService.getCreditosCliente(clienteId));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/creditos/calcular?capital=8000
    // Preview en tiempo real para el formulario de nueva solicitud
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/calcular")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ProductoCalculoDTO> calcular(
            @RequestParam BigDecimal capital,
            @RequestParam(required = false) TipoPago tipoPago,
            Authentication auth) {
        if (capital.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().build();
        }
        TipoPago modo = tipoPago == null ? TipoPago.DIARIO : tipoPago;
        Long sucursalId = principal(auth).sucursalId();
        CreditoCalculoService.ResumenCalculo calculo = modo == TipoPago.SEMANAL
                ? calculoService.calcularCreditoSemanal(capital, sucursalId)
                : calculoService.calcularCredito(capital, sucursalId);
        CreditoCalculoService.ProductoCredito producto = modo == TipoPago.SEMANAL
                ? calculoService.determinarProductoSemanal(capital, sucursalId)
                : calculoService.determinarProducto(capital, sucursalId);
        return ResponseEntity.ok(ProductoCalculoDTO.from(calculo, producto.descripcion(), modo));
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ────────────────────────────────────────────────────────────────────

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }

    private EstadoCredito parseEstado(String s) {
        if (s == null || s.isBlank())
            return null;
        try {
            return EstadoCredito.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Para ASESOR_COBRADOR: fuerza su asesorId y sucursalId.
     * Para SUPERVISOR_CAMPO: fuerza su sucursalId.
     */
    private CreditoCreateRequest normalizarCreate(CreditoCreateRequest req, JwtPrincipal p) {
        return switch (p.rol()) {
            case "ASESOR_COBRADOR" -> new CreditoCreateRequest(
                    req.clienteId(),
                    p.userId(), // asesorId forzado
                    p.sucursalId(), // sucursalId forzado
                    req.montoSolicitado(),
                    req.tipoPago(),
                    req.garantiaDescripcion(),
                    req.evidenciaUrls(),
                    req.lugar());
            case "SUPERVISOR_CAMPO" -> new CreditoCreateRequest(
                    req.clienteId(),
                    req.asesorId(),
                    p.sucursalId(), // sucursalId forzado
                    req.montoSolicitado(),
                    req.tipoPago(),
                    req.garantiaDescripcion(),
                    req.evidenciaUrls(),
                    req.lugar());
            default -> req; // ADMINISTRADOR / SUPERVISOR sin restricción
        };
    }

    /**
     * Verifica que el ASESOR_COBRADOR solo pueda ver créditos de sus clientes,
     * y SUPERVISOR_CAMPO solo de su sucursal.
     */
    private void verificarAcceso(CreditoDetalleDTO dto, JwtPrincipal p) {
        switch (p.rol()) {
            case "ASESOR_COBRADOR" -> {
                if (!dto.asesor().id().equals(p.userId())) {
                    throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.FORBIDDEN,
                            "No tienes acceso a este crédito");
                }
            }
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(p.sucursalId())) {
                    throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.FORBIDDEN,
                            "No tienes acceso a este crédito");
                }
            }
        }
    }
}
