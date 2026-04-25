package com.magno.security;

import com.magno.model.EstadoCaja;
import com.magno.repository.CajaDiaRepository;
import com.magno.util.DateTimeUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Component
public class CajaGuard {

    private static final Set<String> ROLES_BLOQUEADOS = Set.of("ASESOR_COBRADOR", "SUPERVISOR_CAMPO");

    private final CajaDiaRepository cajaDiaRepo;

    public CajaGuard(CajaDiaRepository cajaDiaRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
    }

    public void validarCajaAbierta(JwtPrincipal principal) {
        if (!ROLES_BLOQUEADOS.contains(principal.rol())) return;
        boolean abierta = cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(
                principal.sucursalId(), DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA);
        if (!abierta) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No es posible registrar operaciones — la caja está cerrada");
        }
    }
}
