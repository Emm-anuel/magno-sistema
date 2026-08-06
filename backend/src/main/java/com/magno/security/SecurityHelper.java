package com.magno.security;

import com.magno.repository.ClienteRepository;
import com.magno.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Helper de seguridad para validaciones de acceso a nivel de negocio.
 * Usado en módulos que requieren filtrado por asesor (Créditos, Renovaciones, Historial)
 * o por sucursal (Clientes y, en fases futuras, el resto de módulos de Supervisor).
 */
@Component
public class SecurityHelper {

    private final ClienteRepository clienteRepo;
    private final UsuarioRepository usuarioRepo;

    public SecurityHelper(ClienteRepository clienteRepo, UsuarioRepository usuarioRepo) {
        this.clienteRepo = clienteRepo;
        this.usuarioRepo = usuarioRepo;
    }

    /**
     * Verifica que el cliente pertenezca al usuario autenticado.
     * Solo aplica para ASESOR_COBRADOR y SUPERVISOR_CAMPO; los roles superiores siempre pasan.
     *
     * @throws ResponseStatusException 403 si el cliente no pertenece al usuario.
     */
    public boolean esMiCliente(Long clienteId, Authentication auth) {
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        return switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> {
                boolean esAsesor = clienteRepo.findById(clienteId)
                        .map(c -> c.getAsesor() != null && c.getAsesor().getId().equals(principal.userId()))
                        .orElse(false);
                if (!esAsesor) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
                yield true;
            }
            case "SUPERVISOR_CAMPO" -> {
                boolean esSucursal = clienteRepo.findById(clienteId)
                        .map(c -> c.getSucursal().getId().equals(principal.sucursalId()))
                        .orElse(false);
                if (!esSucursal) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
                yield true;
            }
            default -> true; // ADMINISTRADOR y SUPERVISOR ven todo
        };
    }

    /**
     * Verifica si el usuario autenticado puede operar/consultar datos de una sucursal dada.
     * ADMINISTRADOR: acceso a cualquier sucursal.
     * Cualquier otro rol: su sucursal home, o una sucursal adicional asignada por el
     * Gerente General (tabla usuario_sucursal_adicional).
     */
    public boolean tieneAccesoSucursal(JwtPrincipal principal, Long sucursalId) {
        if (sucursalId == null) return false;
        if ("ADMINISTRADOR".equals(principal.rol())) return true;
        if (sucursalId.equals(principal.sucursalId())) return true;
        return usuarioRepo.existsByIdAndSucursalesAdicionales_Id(principal.userId(), sucursalId);
    }
}
