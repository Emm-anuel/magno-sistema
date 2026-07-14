package com.magno.util;

import java.time.ZoneId;

/**
 * Utilidad para manejo consistente de zonas horarias.
 * MAGNO opera en zona horaria de México (America/Mexico_City, UTC-6).
 */
public class DateTimeUtils {

    public static final ZoneId MAGNO_ZONE = ZoneId.of("America/Mexico_City");

    /**
     * Obtiene la fecha actual en zona horaria de MAGNO (Guatemala).
     * Reemplaza LocalDate.now() en todo el código de negocio.
     */
    public static java.time.LocalDate hoyEnMagno() {
        return java.time.LocalDate.now(MAGNO_ZONE);
    }

    /**
     * Obtiene la fecha/hora actual en zona horaria de MAGNO.
     * Reemplaza OffsetDateTime.now() en todo el código de negocio.
     */
    public static java.time.OffsetDateTime ahoraEnMagno() {
        return java.time.OffsetDateTime.now(MAGNO_ZONE);
    }

    /**
     * Convierte un instante (p. ej. lo que devuelve JPA/pgjdbc para una
     * columna timestamptz, normalizado al offset de la sesión) a la fecha
     * calendario correspondiente en zona horaria de MAGNO. Nunca usar
     * OffsetDateTime.toLocalDate() directamente sobre un valor leído de BD:
     * el offset que trae no es necesariamente -06:00.
     */
    public static java.time.LocalDate toLocalDateEnMagno(java.time.OffsetDateTime instante) {
        return instante.atZoneSameInstant(MAGNO_ZONE).toLocalDate();
    }

    private DateTimeUtils() {
        // Utility class
    }
}
