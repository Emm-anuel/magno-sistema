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

    private DateTimeUtils() {
        // Utility class
    }
}
