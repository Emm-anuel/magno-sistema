package com.magno.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);

        try {
            if (!jwtService.isValid(token)) {
                chain.doFilter(request, response);
                return;
            }

            Claims claims = jwtService.extractAllClaims(token);
            String email = claims.getSubject();
            String rol = claims.get("rol", String.class);
            Long userId = ((Number) claims.get("userId")).longValue();
            Long sucursalId = ((Number) claims.get("sucursalId")).longValue();

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                JwtPrincipal principal = new JwtPrincipal(userId, email, rol, sucursalId);
                var auth = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority(rol))
                );
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        } catch (JwtException | IllegalArgumentException | NullPointerException | ClassCastException ignored) {
            // Token inválido o mal formado → no se establece autenticación, Spring Security denegará
        }

        chain.doFilter(request, response);
    }
}
