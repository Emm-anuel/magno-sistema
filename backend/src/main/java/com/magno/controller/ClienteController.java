package com.magno.controller;

import com.magno.dto.cliente.ClienteCreateRequest;
import com.magno.dto.cliente.ClienteDetalleDTO;
import com.magno.dto.cliente.ClienteDocumentoDTO;
import com.magno.dto.cliente.ClienteResumenDTO;
import com.magno.dto.cliente.ClienteUpdateRequest;
import com.magno.security.CajaGuard;
import com.magno.security.JwtPrincipal;
import com.magno.service.ClienteService;
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

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final ClienteService clienteService;
    private final CajaGuard cajaGuard;

    public ClienteController(ClienteService clienteService, CajaGuard cajaGuard) {
        this.clienteService = clienteService;
        this.cajaGuard = cajaGuard;
    }

    /**
     * GET /api/clientes
     * ASESOR_COBRADOR: solo ve sus propios clientes (filtrado por su asesor_id).
     * El resto: ve todos (con filtros opcionales).
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ClienteResumenDTO>> listar(
            @RequestParam(required = false) String buscar,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("apellidoPaterno", "nombre"));

        JwtPrincipal principal = getPrincipal(auth);

        switch (principal.rol()) {
            case "ASESOR_COBRADOR" ->
                // Solo ve sus propios clientes
                asesorId = principal.userId();
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                // Ve solo los clientes de su sucursal
                if (sucursalId == null) sucursalId = principal.sucursalId();
            }
            // ADMINISTRADOR: sin restricción automática
        }

        return ResponseEntity.ok(
                clienteService.buscarClientes(buscar, estado, asesorId, sucursalId, activo, pageable)
        );
    }

    /** GET /api/clientes/{id} */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> obtener(@PathVariable Long id, Authentication auth) {
        ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);

        JwtPrincipal principal = getPrincipal(auth);
        switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> {
                if (dto.asesor() == null || !dto.asesor().id().equals(principal.userId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
        }

        return ResponseEntity.ok(dto);
    }

    /** POST /api/clientes */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> crear(
            @Valid @RequestBody ClienteCreateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        cajaGuard.validarCajaAbierta(principal);
        ClienteCreateRequest normalizado = normalizarCreate(req, principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clienteService.crearCliente(normalizado, principal.userId()));
    }

    /** PUT /api/clientes/{id} */
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteUpdateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        cajaGuard.validarCajaAbierta(principal);
        ClienteUpdateRequest normalizado = normalizarUpdate(req, principal);
        return ResponseEntity.ok(clienteService.actualizarCliente(id, normalizado));
    }

    /** PATCH /api/clientes/{id}/estado */
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<ClienteResumenDTO> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        Boolean activo = (Boolean) body.get("activo");
        String motivo = (String) body.getOrDefault("motivo", "");
        if (activo == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(clienteService.cambiarEstado(id, activo, motivo));
    }

    /** GET /api/clientes/verificar-curp?curp=XXX[&excludeId=N] */
    @GetMapping("/verificar-curp")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> verificarCurp(
            @RequestParam String curp,
            @RequestParam(required = false) Long excludeId) {
        return ResponseEntity.ok(Map.of("disponible", clienteService.curpDisponible(curp, excludeId)));
    }

    /** GET /api/clientes/verificar-celular?celular=XXX[&excludeId=N] */
    @GetMapping("/verificar-celular")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> verificarCelular(
            @RequestParam String celular,
            @RequestParam(required = false) Long excludeId) {
        return ResponseEntity.ok(Map.of("disponible", clienteService.celularDisponible(celular, excludeId)));
    }

    /** GET /api/clientes/{id}/historial — Por implementar en Módulo 3 */
    @GetMapping("/{id}/historial")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<?>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(List.of());
    }

    /**
     * GET /api/clientes/asesores — Lista resumida de asesores activos.
     * SUPERVISOR_CAMPO: solo ve los asesores de su sucursal.
     * ADMINISTRADOR / SUPERVISOR: ve todos.
     */
    @GetMapping("/asesores")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO')")
    public ResponseEntity<List<Map<String, Object>>> listarAsesores(Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        Long sucursalId = ("SUPERVISOR_CAMPO".equals(principal.rol()) || "SUPERVISOR".equals(principal.rol()))
                ? principal.sucursalId() : null;
        return ResponseEntity.ok(clienteService.listarAsesores(sucursalId));
    }

    // ── Helpers ───────────────────────────────────────────────────
    private JwtPrincipal getPrincipal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }

    /**
     * Normaliza el request de creación según el rol:
     * - ASESOR_COBRADOR: fuerza su propio id como asesorId y su sucursal como sucursalId.
     * - SUPERVISOR_CAMPO: puede elegir asesor, pero sucursalId queda fijo al suyo.
     * - ADMINISTRADOR / SUPERVISOR: sin restricciones.
     *
     * Patrón de filtrado por rol (aplicar en todos los módulos futuros):
     * ADMINISTRADOR y SUPERVISOR → ven todo
     * SUPERVISOR_CAMPO y ASESOR_COBRADOR → solo sus clientes
     */
    private ClienteCreateRequest normalizarCreate(ClienteCreateRequest req, JwtPrincipal p) {
        return switch (p.rol()) {
            case "ASESOR_COBRADOR" -> new ClienteCreateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(),
                    req.negocioCalle(), req.negocioNoExterior(), req.negocioNoInterior(),
                    req.negocioColonia(), req.negocioMunicipio(), req.negocioEstado(), req.negocioCp(),
                    req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.negocioLat(), req.negocioLng(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    p.userId(),      // asesorId forzado
                    p.sucursalId()   // sucursalId forzado
            );
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> new ClienteCreateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(),
                    req.negocioCalle(), req.negocioNoExterior(), req.negocioNoInterior(),
                    req.negocioColonia(), req.negocioMunicipio(), req.negocioEstado(), req.negocioCp(),
                    req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.negocioLat(), req.negocioLng(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    req.asesorId(),  // puede elegir asesor
                    p.sucursalId()   // sucursalId forzado
            );
            default -> req; // ADMINISTRADOR sin cambios
        };
    }

    // ── Documentos del cliente ────────────────────────────────────────

    private static final java.util.Set<String> TIPOS_DOCUMENTO_VALIDOS =
        java.util.Set.of("INE_FRENTE", "INE_REVERSO", "COMPROBANTE_DOMICILIO", "OTRO");

    record AgregarDocumentoRequest(
        @jakarta.validation.constraints.NotBlank String tipo,
        @jakarta.validation.constraints.NotBlank String url,
        String nombre
    ) {}

    @GetMapping("/{id}/documentos")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ClienteDocumentoDTO>> listarDocumentos(
            @PathVariable Long id, Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);
        switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> {
                if (dto.asesor() == null || !dto.asesor().id().equals(principal.userId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        return ResponseEntity.ok(clienteService.listarDocumentos(id));
    }

    @PostMapping("/{id}/documentos")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDocumentoDTO> agregarDocumento(
            @PathVariable Long id,
            @Valid @RequestBody AgregarDocumentoRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);
        switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> {
                if (dto.asesor() == null || !dto.asesor().id().equals(principal.userId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        if (!TIPOS_DOCUMENTO_VALIDOS.contains(req.tipo())) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clienteService.agregarDocumento(id, req.tipo(), req.url(), req.nombre(), principal.userId()));
    }

    @DeleteMapping("/{clienteId}/documentos/{docId}")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<Void> eliminarDocumento(
            @PathVariable Long clienteId,
            @PathVariable Long docId) {
        clienteService.eliminarDocumento(docId, clienteId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Normaliza el request de actualización según el rol.
     * Misma lógica que normalizarCreate pero para ClienteUpdateRequest.
     */
    private ClienteUpdateRequest normalizarUpdate(ClienteUpdateRequest req, JwtPrincipal p) {
        return switch (p.rol()) {
            case "ASESOR_COBRADOR" -> new ClienteUpdateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(),
                    req.negocioCalle(), req.negocioNoExterior(), req.negocioNoInterior(),
                    req.negocioColonia(), req.negocioMunicipio(), req.negocioEstado(), req.negocioCp(),
                    req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.negocioLat(), req.negocioLng(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    p.userId(),      // asesorId forzado
                    p.sucursalId()   // sucursalId forzado
            );
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> new ClienteUpdateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(),
                    req.negocioCalle(), req.negocioNoExterior(), req.negocioNoInterior(),
                    req.negocioColonia(), req.negocioMunicipio(), req.negocioEstado(), req.negocioCp(),
                    req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.negocioLat(), req.negocioLng(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    req.asesorId(),  // puede elegir asesor
                    p.sucursalId()   // sucursalId forzado
            );
            default -> req; // ADMINISTRADOR sin cambios
        };
    }
}
