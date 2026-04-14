package com.magno.security;

import com.magno.repository.ClienteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Helper de seguridad para validaciones de acceso a nivel de negocio.
 * Usado en módulos que requieren filtrado por asesor (Créditos, Renovaciones, Historial).
 */
@Component
public class SecurityHelper {

    private final ClienteRepository clienteRepo;

    public SecurityHelper(ClienteRepository clienteRepo) {
        this.clienteRepo = clienteRepo;
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
}
