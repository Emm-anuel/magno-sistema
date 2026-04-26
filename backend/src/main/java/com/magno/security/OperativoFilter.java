package com.magno.security;

import com.magno.model.ConfigSucursal;
import com.magno.repository.ConfigSucursalRepository;
import com.magno.util.DateTimeUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalTime;
import java.util.Set;

@Component
public class OperativoFilter extends OncePerRequestFilter {

    private static final Set<String> FIELD_ROLES  = Set.of("ASESOR_COBRADOR", "SUPERVISOR_CAMPO");
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final ConfigSucursalRepository configRepo;

    public OperativoFilter(ConfigSucursalRepository configRepo) {
        this.configRepo = configRepo;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        if (!WRITE_METHODS.contains(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        if (request.getRequestURI().startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal principal)) {
            chain.doFilter(request, response);
            return;
        }

        if (!FIELD_ROLES.contains(principal.rol())) {
            chain.doFilter(request, response);
            return;
        }

        LocalTime horaLimite = configRepo.findBySucursalId(principal.sucursalId())
                .map(ConfigSucursal::getHoraLimiteOperacion)
                .orElse(LocalTime.of(17, 0));

        if (LocalTime.now(DateTimeUtils.MAGNO_ZONE).isAfter(horaLimite)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"error\":\"No es posible registrar operaciones después de las 5:00 PM\"}");
            return;
        }

        chain.doFilter(request, response);
    }
}
