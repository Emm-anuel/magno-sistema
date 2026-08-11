package com.magno.model;

import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class RegistrosPagoTimestampTest {

    @Test
    void pagoRegistraFechaHoraEnZonaMagno() {
        Pago pago = new Pago();

        pago.prePersist();

        assertZonaMagno(pago.getCreatedAt());
        assertThat(pago.getUpdatedAt()).isEqualTo(pago.getCreatedAt());
    }

    @Test
    void abonoRegistraFechaHoraEnZonaMagno() {
        AbonoCorriente abono = new AbonoCorriente();

        abono.prePersist();

        assertZonaMagno(abono.getCreatedAt());
    }

    @Test
    void pagoNominaRegistraFechaHoraEnZonaMagno() {
        NominaPago pago = new NominaPago();

        pago.prePersist();

        assertZonaMagno(pago.getCreatedAt());
    }

    private void assertZonaMagno(OffsetDateTime fechaHora) {
        assertThat(fechaHora).isNotNull();
        assertThat(fechaHora.getOffset())
                .isEqualTo(DateTimeUtils.MAGNO_ZONE.getRules().getOffset(fechaHora.toInstant()));
    }
}
