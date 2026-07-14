package com.magno.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class DateTimeUtilsTest {

    @Test
    void toLocalDateEnMagno_usaElDiaDeMexicoNoElDeUtc() {
        // Un desembolso a las 20:00 en Ciudad de México (UTC-6) el 13 de julio
        // equivale al instante 14 de julio 02:00 UTC. Postgres almacena
        // timestamptz como instante y pgjdbc lo reconstruye con el offset de
        // la sesión (normalmente UTC), así que esto es justo lo que
        // getFechaDesembolso() trae de vuelta tras un round-trip a la BD.
        OffsetDateTime comoLoDevuelveElDriver =
                OffsetDateTime.of(2026, 7, 14, 2, 0, 0, 0, ZoneOffset.UTC);

        assertThat(DateTimeUtils.toLocalDateEnMagno(comoLoDevuelveElDriver))
                .isEqualTo(LocalDate.of(2026, 7, 13));
    }
}
