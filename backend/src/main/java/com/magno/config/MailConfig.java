package com.magno.config;

import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.mail.MailHealthIndicator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Configuración para deshabilitar el health check de correo en desarrollo.
 * Esto previene que Spring Boot Actuator intente conectar al servidor SMTP
 * durante el health check, evitando errores de SSL/TLS.
 */
@Configuration
public class MailConfig {

    /**
     * Bean que reemplaza el MailHealthIndicator por defecto para evitar
     * intentos de conexión al servidor SMTP durante el health check.
     */
    @Bean
    @Primary
    public HealthIndicator mailHealthIndicator(JavaMailSender mailSender) {
        // Retornamos un indicador de salud que siempre reporta UP sin intentar conexión
        return () -> org.springframework.boot.actuate.health.Health.up()
                .withDetail("status", "Mail service disabled in health check")
                .build();
    }
}

