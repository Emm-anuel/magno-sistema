package com.magno.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;
    private final StringRedisTemplate redis;

    public JwtService(
            @Value("${magno.jwt.secret}") String secret,
            @Value("${magno.jwt.expiration-ms:86400000}") long expirationMs,
            StringRedisTemplate redis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
        this.redis = redis;
    }

    /** Genera un JWT con los claims del usuario. */
    public String generate(Long userId, String email, String rol, Long sucursalId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(email)
                .claims(Map.of(
                        "userId", userId,
                        "rol", rol,
                        "sucursalId", sucursalId
                ))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    /** Extrae todos los claims. Lanza JwtException si el token es inválido o expiró. */
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Valida el token y verifica que no esté en la blacklist de Redis. */
    public boolean isValid(String token) {
        try {
            extractAllClaims(token); // lanza si es inválido/expirado
            return !isBlacklisted(token);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /** Agrega el token a la blacklist de Redis hasta su expiración. */
    public void blacklist(String token) {
        try {
            Claims claims = extractAllClaims(token);
            long remaining = claims.getExpiration().getTime() - System.currentTimeMillis();
            if (remaining > 0) {
                redis.opsForValue().set(
                        "blacklist:" + token,
                        "1",
                        remaining,
                        TimeUnit.MILLISECONDS
                );
            }
        } catch (JwtException | IllegalArgumentException ignored) {
            // Token ya inválido, no hace falta blacklistearlo
        }
    }

    private boolean isBlacklisted(String token) {
        return Boolean.TRUE.equals(redis.hasKey("blacklist:" + token));
    }
}
