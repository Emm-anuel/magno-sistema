package com.magno.service;

import com.magno.model.AbonoCoberturaDetalle;
import com.magno.model.CalendarioPago;
import com.magno.model.Pago;
import com.magno.repository.AbonoCoberturaDetalleRepository;
import com.magno.repository.PagoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SaldoCuotaServiceTest {

    private PagoRepository pagoRepo;
    private AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private SaldoCuotaService service;

    @BeforeEach
    void setUp() {
        pagoRepo = mock(PagoRepository.class);
        abonoCoberturaRepo = mock(AbonoCoberturaDetalleRepository.class);
        service = new SaldoCuotaService(pagoRepo, abonoCoberturaRepo);
    }

    @Test
    void montosAbonadosPorCuota_sumaPagoDirectoYAbonoPosterior() {
        CalendarioPago cuotaParcial = new CalendarioPago();
        cuotaParcial.setId(501L);
        CalendarioPago otraCuota = new CalendarioPago();
        otraCuota.setId(502L);

        Pago pagoDirecto = new Pago();
        pagoDirecto.setCalendarioPago(cuotaParcial);
        pagoDirecto.setMontoRecibido(new BigDecimal("125.50"));

        Pago noPago = new Pago();
        noPago.setCalendarioPago(otraCuota);
        noPago.setMontoRecibido(BigDecimal.ZERO);
        noPago.setRazonNoPago("No pagó");

        Pago eliminado = new Pago();
        eliminado.setCalendarioPago(cuotaParcial);
        eliminado.setMontoRecibido(new BigDecimal("999.00"));
        eliminado.setDeletedAt(OffsetDateTime.now());

        AbonoCoberturaDetalle complemento = new AbonoCoberturaDetalle();
        complemento.setCalendarioPago(cuotaParcial);
        complemento.setTotalAplicado(new BigDecimal("74.50"));

        AbonoCoberturaDetalle segundoParcial = new AbonoCoberturaDetalle();
        segundoParcial.setCalendarioPago(otraCuota);
        segundoParcial.setTotalAplicado(new BigDecimal("50.00"));

        when(pagoRepo.findByCreditoIdOrderByNumeroPago(42L))
                .thenReturn(List.of(pagoDirecto, noPago, eliminado));
        when(abonoCoberturaRepo.findByAbono_CreditoIdOrderByNumeroPagoAsc(42L))
                .thenReturn(List.of(complemento, segundoParcial));

        Map<Long, BigDecimal> resultado = service.montosAbonadosPorCuota(42L);

        assertThat(resultado.get(501L)).isEqualByComparingTo("200.00");
        assertThat(resultado.get(502L)).isEqualByComparingTo("50.00");
    }
}
