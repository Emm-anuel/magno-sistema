package com.magno.controller;

import com.magno.dto.cliente.ClienteCreateRequest;
import com.magno.dto.cliente.ClienteDetalleDTO;
import com.magno.dto.cliente.ClienteResumenDTO;
import com.magno.dto.cliente.ClienteUpdateRequest;
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

    public ClienteController(ClienteService clienteService) {
        this.clienteService = clienteService;
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
            case "SUPERVISOR_CAMPO" -> {
                // Ve los clientes de su sucursal (proxy de "sus asesores")
                if (sucursalId == null) sucursalId = principal.sucursalId();
            }
            // ADMINISTRADOR y SUPERVISOR: sin restricción automática
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
            case "SUPERVISOR_CAMPO" -> {
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
        Long sucursalId = "SUPERVISOR_CAMPO".equals(principal.rol()) ? principal.sucursalId() : null;
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
                    req.negocioDireccion(), req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    p.userId(),      // asesorId forzado
                    p.sucursalId()   // sucursalId forzado
            );
            case "SUPERVISOR_CAMPO" -> new ClienteCreateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(), req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    req.asesorId(),  // puede elegir asesor
                    p.sucursalId()   // sucursalId forzado
            );
            default -> req; // ADMINISTRADOR / SUPERVISOR sin cambios
        };
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
                    req.negocioDireccion(), req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    p.userId(),      // asesorId forzado
                    p.sucursalId()   // sucursalId forzado
            );
            case "SUPERVISOR_CAMPO" -> new ClienteUpdateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(), req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    req.asesorId(),  // puede elegir asesor
                    p.sucursalId()   // sucursalId forzado
            );
            default -> req; // ADMINISTRADOR / SUPERVISOR sin cambios
        };
    }
}
